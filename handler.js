'use strict';

const productManager = require('./productManager');
const athena = require('./athena');

module.exports.createProduct = async (event) => {
  const product = JSON.parse(event.body);
  
  try {
    await productManager.saveProduct(product);
  
    return {
      statusCode: 200,
      body: 'Product was saved in the storage'
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: error
    };
  }
};

module.exports.searchProductByName = async (event) => {
  const name = event.queryStringParameters && event.queryStringParameters.name;
  const result = await athena.searchProductByName(name);

  return {
    statusCode: 200,
    body: JSON.stringify(result)
  };
}
