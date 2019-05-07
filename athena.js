'use strict';

const AWS = require('aws-sdk');
const athena = new AWS.Athena();
const crypto = require('crypto');

const DATABASE_NAME = process.env.DATABASE_NAME;
const BUCKET_NAME = process.env.BUCKET_NAME;
const ATHENA_BUCKET_NAME = process.env.ATHENA_BUCKET_NAME;

const QUERY_TABLE = "\
    CREATE EXTERNAL TABLE IF NOT EXISTS products ( \
        `productid` string, \
        `name` string, \
        `color` string  \
    ) \
    ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe' \
    WITH SERDEPROPERTIES ( \
        'serialization.format' = '1' \
    ) LOCATION 's3://" + BUCKET_NAME + "/raw/' \
    TBLPROPERTIES ('has_encrypted_data'='false');"

const QUERY_DATABASE = "\
    CREATE DATABASE IF NOT EXISTS " + DATABASE_NAME + "\
    LOCATION 's3://"+ BUCKET_NAME +"/';"

module.exports.init = async (event) => {
    await startQueryExecutionAthena(QUERY_DATABASE);
    await startQueryExecutionAthena(QUERY_TABLE);
    return;
}

module.exports.searchProductByName = async (name) => {
    const searchQuery = "SELECT * FROM products WHERE name='"+ name +"' ";
    const queryExecutionIdSearch = await startQueryExecutionAthena(searchQuery);
    return getQueryResults(queryExecutionIdSearch);
}

async function startQueryExecutionAthena(query) {
    var queryHash = crypto.createHash('md5').update(query).digest('hex');

    const params = {
        QueryString: query,
        
        QueryExecutionContext: {
          Database: DATABASE_NAME
        },
        ResultConfiguration: {
          OutputLocation: `s3://${ATHENA_BUCKET_NAME}/${queryHash}/`
        }
      };

    return athena.startQueryExecution(params).promise();
}

async function getQueryResults(queryExecutionId) {
    var executionDone = false;

    while (!executionDone) {
        executionDone = await isExecutionDone(queryExecutionId);
        console.log('waiting...')
        sleep(2000);
    }
    
    const results = await athena.getQueryResults(queryExecutionId).promise();    
    return Promise.resolve(formatResults(results));
}

function sleep(delay) {
    var start = new Date().getTime();
    while (new Date().getTime() < start + delay);
}

async function isExecutionDone(queryExecutionId) {
    const result = await athena.getQueryExecution(queryExecutionId).promise();
    
    if (result.QueryExecution.Status.State === 'SUCCEEDED') {
        return Promise.resolve(true);
    } else {
        return Promise.resolve(false); 
    }
}

function formatResults(results) {
    var formattedResults = [];
    const rows = results.ResultSet.Rows;

    rows.forEach(function(row) {    
        var value = {
            productId: row.Data[0].VarCharValue,
            name: row.Data[1].VarCharValue,
            color: row.Data[2].VarCharValue
        };

        formattedResults.push(value);
    });

    return formattedResults;
}

