const axios = require("axios");

const callComplianceCSID = async (csr) => {
  try {
    const response = await axios.post(
      "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance",
      { csr }, // only CSR in the body
      {
        headers: {
          "Content-Type": "application/json",
          otp: "123456", // static for sandbox
          "Accept-Version": "V2", // API version
        },
      }
    );
    console.log(response, "Response");

    return {
      token: response.data.binarySecurityToken,
      certificate: response.data.certificate,
      requestID: response.data.requestID,
      secret: response.data.secret,
    };
  } catch (error) {
    console.error(
      "Error in callComplianceCSID:",
      error.response?.data || error.message
    );
    throw new Error(
      `Compliance CSID call failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
};

const reportInvoiceToZATCA = async (token, signedInvoice) => {
  try {
    const response = await axios.post(
      "https://gw-fatoora.zatca.gov.sa/e-invoicing/invoices/developer-portal/reporting/single",
      {
        invoice: signedInvoice,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error in reportInvoiceToZATCA:",
      error.response?.data || error.message
    );
    throw new Error(
      `Invoice reporting failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
};

module.exports = {
  callComplianceCSID,
  reportInvoiceToZATCA,
};
