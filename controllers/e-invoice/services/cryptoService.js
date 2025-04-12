const crypto = require("crypto");
const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");
const businessProfile = require("../../../models/businessProfile");
const axios = require("axios");

// function generateNewKeysAndCSR(solutionName, egsInfo, isProduction = false) {
//   const privateKey = generateSecp256k1KeyPair();
//   const csr = generateCSR(solutionName, privateKey, egsInfo, isProduction);
//   const csrBase64 = Buffer.from(csr).toString('base64');
//   return [privateKey, csr, csrBase64];
// };

function generateNewKeysAndCSR(solutionName, egsInfo, isProduction = false) {
  const privateKey = generateSecp256k1KeyPair();
  const { csr, privateKeyFileName } = generateCSR(
    solutionName,
    privateKey,
    egsInfo,
    isProduction
  );
  const csrBase64 = Buffer.from(csr).toString("base64");
  return { privateKeyFileName, privateKey, csr, csrBase64 };
}

function generateSecp256k1KeyPair() {
  try {
    const result = execSync(
      "openssl ecparam -name secp256k1 -genkey"
    ).toString();
    const parts = result.split("-----BEGIN EC PRIVATE KEY-----");

    if (!parts[1]) throw new Error("No private key found in OpenSSL output.");

    const keyContent = parts[1].trim();
    return `-----BEGIN EC PRIVATE KEY-----\n${keyContent}`.trim();
  } catch (error) {
    throw new Error(`Failed to generate key pair: ${error.message}`);
  }
}

function generateCSR(solutionName, privateKey, egsInfo, isProduction) {
  if (!privateKey) throw new Error("EGS has no private key");

  const tmpDir = path.join(__dirname, "../", "../", "../", "tmp", "keys");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true, mode: 0o775 });
  }

  const privateKeyFileName = path.join(tmpDir, `${uuid()}.pem`);
  const csrConfigFileName = path.join(tmpDir, `${uuid()}.cnf`);
  console.log(privateKeyFileName, "privateKeyFileName Drectory");
  try {
    fs.writeFileSync(privateKeyFileName, privateKey);

    const csrConfig = `[req]
prompt = no
utf8 = no
distinguished_name = my_req_dn_prompt
req_extensions = v3_req

[v3_req]
1.3.6.1.4.1.311.20.2 = ASN1:UTF8String:${
      isProduction ? "ZATCA-Code-Signing" : "TSTZATCA-Code-Signing"
    }
subjectAltName=dirName:dir_sect

[dir_sect]
SN = 1-${solutionName}|2-${egsInfo.model}|3-${egsInfo.uuid}
UID = ${egsInfo.VAT_number}
title = 0100
registeredAddress = ${egsInfo.location.building} ${egsInfo.location.street}, ${
      egsInfo.location.city
    }
businessCategory = ${egsInfo.branch_industry}

[my_req_dn_prompt]
commonName = ${egsInfo.custom_id}
organizationalUnitName = ${egsInfo.branch_name}
organizationName = ${egsInfo.VAT_name}
countryName = SA`;

    fs.writeFileSync(csrConfigFileName, csrConfig);

    const result = execSync(
      `openssl req -new -sha256 -key "${privateKeyFileName}" -config "${csrConfigFileName}"`,
      { stdio: ["ignore", "pipe", "pipe"] }
    ).toString();

    const parts = result.split("-----BEGIN CERTIFICATE REQUEST-----");
    if (!parts[1])
      throw new Error("Failed to generate CSR - no CSR found in output");

    return {
      csr: `-----BEGIN CERTIFICATE REQUEST-----${parts[1]}`.trim(),
      privateKeyFileName: path.basename(privateKeyFileName),
    };
  } catch (error) {
    console.error("CSR Generation Error:", error.message);
    if (error.stderr) console.error("OpenSSL Error:", error.stderr.toString());
    throw new Error(`CSR generation failed: ${error.message}`);
  } finally {
    try {
      if (fs.existsSync(csrConfigFileName)) fs.unlinkSync(csrConfigFileName);
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError.message);
    }
  }
}

function uuid() {
  return crypto.randomUUID();
}

// Example usage with sample data
const egsInfo = {
  model: "EGS-Model",
  uuid: crypto.randomUUID(),
  VAT_number: "300000000000003",
  location: {
    building: "Commercial Building",
    street: "Main Street",
    city: "Riyadh",
  },
  branch_industry: "Retail",
  branch_name: "Main Branch",
  VAT_name: "Taxpayer Company Name",
  custom_id: "TP-123456",
};

// Invoice Functions
function generateInvoiceXML(invoice, egsUnit) {
  const lineItemsXML = invoice.line_items
    .map((item) => generateLineItemXML(item))
    .join("");

  const invoiceXML = `
    <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
             xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
             xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
      <cbc:ID>${invoice.invoice_serial_number}</cbc:ID>
      <cbc:IssueDate>${invoice.issue_date}</cbc:IssueDate>
      <cbc:IssueTime>${invoice.issue_time}</cbc:IssueTime>
      <cbc:InvoiceTypeCode>${
        INVOICE_TYPES[egsUnit.cancelation.cancelation_type]
      }</cbc:InvoiceTypeCode>
      
      <cac:AccountingSupplierParty>
        <cac:Party>
          <cac:PartyIdentification>
            <cbc:ID schemeID="CRN">${egsUnit.CRN_number}</cbc:ID>
          </cac:PartyIdentification>
          <cac:PartyName>
            <cbc:Name>${egsUnit.VAT_name}</cbc:Name>
          </cac:PartyName>
          <cac:PostalAddress>
            <cbc:StreetName>${egsUnit.location.street}</cbc:StreetName>
            <cbc:BuildingNumber>${
              egsUnit.location.building
            }</cbc:BuildingNumber>
            <cbc:CitySubdivisionName>${
              egsUnit.location.city_subdivision
            }</cbc:CitySubdivisionName>
            <cbc:CityName>${egsUnit.location.city}</cbc:CityName>
            <cbc:PostalZone>${egsUnit.location.postal_zone}</cbc:PostalZone>
          </cac:PostalAddress>
          <cac:PartyTaxScheme>
            <cbc:CompanyID>${egsUnit.VAT_number}</cbc:CompanyID>
            <cac:TaxScheme>
              <cbc:ID>VAT</cbc:ID>
            </cac:TaxScheme>
          </cac:PartyTaxScheme>
        </cac:Party>
      </cac:AccountingSupplierParty>
      
      <cac:AccountingCustomerParty/>
      
      ${lineItemsXML}
    </Invoice>
  `;

  return invoiceXML;
}

function generateLineItemXML(item) {
  const subtotal = item.quantity * item.tax_exclusive_price;
  const taxAmount = subtotal * item.VAT_percent;

  return `
    <cac:InvoiceLine>
      <cbc:ID>${item.id}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${
        item.quantity
      }</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${subtotal.toFixed(
        2
      )}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${taxAmount.toFixed(2)}</cbc:TaxAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${item.name}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${item.VAT_percent ? "S" : "O"}</cbc:ID>
          <cbc:Percent>${(item.VAT_percent * 100).toFixed(2)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${item.tax_exclusive_price.toFixed(
          2
        )}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>
  `;
}

function getInvoiceHash(invoiceXML) {
  // Remove unnecessary elements for hash calculation
  const pureInvoice = invoiceXML
    .replace(/<UBLExtensions>.*?<\/UBLExtensions>/gs, "")
    .replace(/<Signature>.*?<\/Signature>/gs, "")
    .replace(
      /<AdditionalDocumentReference>.*?<\/AdditionalDocumentReference>/gs,
      ""
    );

  const hash = crypto.createHash("sha256").update(pureInvoice).digest();
  return hash.toString("base64");
}

// ZATCA API Functions
async function issueComplianceCertificate(csr, otp) {
  try {
    const response = await axios.post(
      `${ZATCA_API_URL}/compliance/certificates`,
      {
        csr,
        otp,
      }
    );

    return {
      requestId: response.data.requestID,
      binarySecurityToken: response.data.binarySecurityToken,
      secret: response.data.secret,
    };
  } catch (error) {
    console.error("Error issuing compliance certificate:", error);
    throw error;
  }
}

async function checkInvoiceCompliance(payload,) {
  try {
    const API_URL =
      "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance/invoices";

    const headers = {
      "Accept-Version": "V2", // or your dynamic version
      "Accept-Language": "en",
      "Content-Type": "application/json",
      Authorization:
        "Basic VFVsSlExQlVRME5CWlU5blFYZEpRa0ZuU1VkQldYcDZaMFZvVGsxQmIwZERRM0ZIVTAwME9VSkJUVU5OUWxWNFJYcEJVa0puVGxaQ1FVMU5RMjFXU21KdVduWmhWMDV3WW0xamQwaG9ZMDVOYWxGM1RWUkZkMDFVVFhoTlZGVXdWMmhqVGsxcWEzZE5WRUUxVFdwRmQwMUVRWGRYYWtJeFRWRnpkME5SV1VSV1VWRkhSWGRLVkZGVVJWZE5RbEZIUVRGVlJVTjNkMDVWYld3MVdWZFNiMGxGU25sWlZ6VnFZVVJGYlUxRFVVZEJNVlZGUTJkM1pGUlhSalJoVnpFeFlsTkNWR05IVm14YVEwSlZXbGRPYjBsR1RqRmpTRUp6WlZOQ1RWWkZVWGhLYWtGclFtZE9Wa0pCVFUxSVZsSlVWa013TkU5RVdUQk5la1Y0VGtSVmRFMTZhelZQVkdzMVQxUnJOVTlVUVhkTlJFRjZUVVpaZDBWQldVaExiMXBKZW1vd1EwRlJXVVpMTkVWRlFVRnZSRkZuUVVWdlYwTkxZVEJUWVRsR1NVVnlWRTkyTUhWQmEwTXhWa2xMV0hoVk9XNVFjSGd5ZG14bU5IbG9UV1ZxZVRoak1ESllTbUpzUkhFM2RGQjVaRzg0YlhFd1lXaFBUVzFPYnpobmQyNXBOMWgwTVV0VU9WVmxTMDlDZDFSRFFuWnFRVTFDWjA1V1NGSk5Ra0ZtT0VWQmFrRkJUVWxIZEVKblRsWklVa1ZGWjJGVmQyZGhTMnRuV2poM1oxcDNlRTk2UVRWQ1owNVdRa0ZSVFUxcVJYUldSazVWWmtSSmRGWkdUbFZtUkUxMFdsZFJlVTF0V1hoYVJHZDBXbFJhYUUxcE1IaE5WRVUwVEZSc2FVNVVaM1JhUkd4b1QwZFplRTFYVlRCT1JGWnRUVkk0ZDBoUldVdERXa2x0YVZwUWVVeEhVVUpCVVhkUVRYcHJOVTlVYXpWUFZHczFUMVJCZDAxRVFYcE5VVEIzUTNkWlJGWlJVVTFFUVZGNFRWUkJkMDFTUlhkRWQxbEVWbEZSWVVSQmFGTlZiRXBGVFdwcmVVOVVSV0ZOUW1kSFFURlZSVVIzZDFKVk0xWjNZMGQ0TlVsSFJtcGtSMnd5WVZoU2NGcFlUWGREWjFsSlMyOWFTWHBxTUVWQmQwbEVVMEZCZDFKUlNXaEJTVVk0YWtsamVIcDJRM2x4VlVSVWNEVlBiWFkzTWxWd2VGQkJURzF2VW5sME9VUlpNalJxVjIxQ1VVRnBRVEJpWVZvMldYSndjRFY1U2pSaGFHOXZiMWN6SzA5aE9HdHJZak14WlhaQmIwaGtkbWRFT0RBMk0zYzlQUT09OlBLb0dzU3dwUHgyMzZ5TlM3Q1dEb2pWNGRvZTFpMFcrNW1Qb2RiTUVXNWs9",

      // ...authHeaders,
    };

    console.log(JSON.stringify(payload, null, 2));


    // console.log(JSON.stringify(payload), "Payload");

    const response = await axios.post(API_URL, JSON.stringify(payload), {
      headers,
    });

  
    console.log(response.data, "Response");

    return response.data;
  } catch (error) {
    console.log(
      "Error checking invoice compliances:",
      error?.response?.data || error
    );
    // throw error;
  }
}

const INVOICE_TYPES = {
  INVOICE: 388,
  DEBIT_NOTE: 383,
  CREDIT_NOTE: 381,
};

// Invoice Functions
function generateInvoiceXML(invoice, egsUnit) {
  const lineItemsXML = invoice.line_items
    .map((item) => generateLineItemXML(item))
    .join("");

  const invoiceXML = `
    <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
             xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
             xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
      <cbc:ID>${invoice.invoice_serial_number}</cbc:ID>
      <cbc:IssueDate>${invoice.issue_date}</cbc:IssueDate>
      <cbc:IssueTime>${invoice.issue_time}</cbc:IssueTime>
      <cbc:InvoiceTypeCode>${
        INVOICE_TYPES[egsUnit.cancelation.cancelation_type]
      }</cbc:InvoiceTypeCode>
      
      <cac:AccountingSupplierParty>
        <cac:Party>
          <cac:PartyIdentification>
            <cbc:ID schemeID="CRN">${egsUnit.CRN_number}</cbc:ID>
          </cac:PartyIdentification>
          <cac:PartyName>
            <cbc:Name>${egsUnit.VAT_name}</cbc:Name>
          </cac:PartyName>
          <cac:PostalAddress>
            <cbc:StreetName>${egsUnit.location.street}</cbc:StreetName>
            <cbc:BuildingNumber>${
              egsUnit.location.building
            }</cbc:BuildingNumber>
            <cbc:CitySubdivisionName>${
              egsUnit.location.city_subdivision
            }</cbc:CitySubdivisionName>
            <cbc:CityName>${egsUnit.location.city}</cbc:CityName>
            <cbc:PostalZone>${egsUnit.location.postal_zone}</cbc:PostalZone>
          </cac:PostalAddress>
          <cac:PartyTaxScheme>
            <cbc:CompanyID>${egsUnit.VAT_number}</cbc:CompanyID>
            <cac:TaxScheme>
              <cbc:ID>VAT</cbc:ID>
            </cac:TaxScheme>
          </cac:PartyTaxScheme>
        </cac:Party>
      </cac:AccountingSupplierParty>
      
      <cac:AccountingCustomerParty/>
      
      ${lineItemsXML}
    </Invoice>
  `;

  return invoiceXML;
}

function generateLineItemXML(item) {
  const subtotal = item.quantity * item.tax_exclusive_price;
  const taxAmount = subtotal * item.VAT_percent;

  return `
    <cac:InvoiceLine>
      <cbc:ID>${item.id}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="PCE">${
        item.quantity
      }</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${subtotal.toFixed(
        2
      )}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${taxAmount.toFixed(2)}</cbc:TaxAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${item.name}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${item.VAT_percent ? "S" : "O"}</cbc:ID>
          <cbc:Percent>${(item.VAT_percent * 100).toFixed(2)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${item.tax_exclusive_price.toFixed(
          2
        )}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>
  `;
}

function getInvoiceHash(invoiceXML) {
  // Remove unnecessary elements for hash calculation
  const pureInvoice = invoiceXML
    .replace(/<UBLExtensions>.*?<\/UBLExtensions>/gs, "")
    .replace(/<Signature>.*?<\/Signature>/gs, "")
    .replace(
      /<AdditionalDocumentReference>.*?<\/AdditionalDocumentReference>/gs,
      ""
    );

  const hash = crypto.createHash("sha256").update(pureInvoice).digest();
  return hash.toString("base64");
}

function signInvoice(invoiceXML, privateKey) {
  const invoiceHash = getInvoiceHash(invoiceXML);
  const sign = crypto.createSign("sha256");
  sign.update(invoiceHash);
  sign.end();

  const signature = sign.sign({
    key: `-----BEGIN EC PRIVATE KEY-----\n${privateKey}\n-----END EC PRIVATE KEY-----`,
    format: "pem",
    type: "sec1",
  });

  return {
    signedInvoice: invoiceXML, // In a real implementation, you'd add the signature to the XML
    invoiceHash,
    signature: signature.toString("base64"),
  };
}

function generateQRCode(invoiceData, egsUnit, signature) {
  const sellerName = egsUnit.VAT_name;
  const vatNumber = egsUnit.VAT_number;
  const invoiceTotal = invoiceData.line_items
    .reduce((total, item) => {
      return (
        total +
        item.quantity * item.tax_exclusive_price * (1 + item.VAT_percent)
      );
    }, 0)
    .toFixed(2);

  const vatTotal = invoiceData.line_items
    .reduce((total, item) => {
      return (
        total + item.quantity * item.tax_exclusive_price * item.VAT_percent
      );
    }, 0)
    .toFixed(2);

  const timestamp = `${invoiceData.issue_date}T${invoiceData.issue_time}`;
  const invoiceHash = getInvoiceHash(generateInvoiceXML(invoiceData, egsUnit));

  // TLV encoding for QR code
  const tlvData = [
    { tag: 1, value: sellerName },
    { tag: 2, value: vatNumber },
    { tag: 3, value: timestamp },
    { tag: 4, value: invoiceTotal },
    { tag: 5, value: vatTotal },
    { tag: 6, value: invoiceHash },
    { tag: 7, value: signature },
  ];

  let qrCode = "";
  tlvData.forEach((item) => {
    const length = Buffer.byteLength(item.value, "utf8");
    qrCode +=
      String.fromCharCode(item.tag) + String.fromCharCode(length) + item.value;
  });

  return Buffer.from(qrCode).toString("base64");
}

function loadPrivateKeyWithoutHeaderFooter(filePath) {
  const keyContent = fs.readFileSync(filePath, "utf8");
  const cleanedKey = keyContent
    .replace(/-----BEGIN EC PRIVATE KEY-----/g, "")
    .replace(/-----END EC PRIVATE KEY-----/g, "")
    .replace(/\r?\n|\r/g, "") // remove all line breaks
    .trim();

  return cleanedKey;
}

// Example Usage
async function main(privateKeyFilePath, binarySecurityToken) {
  // Sample data

  console.log(
    path.join(
      __dirname,
      "../",
      "../",
      "../",
      "tmp",
      "keys",
      privateKeyFilePath
    ),
    "File"
  );

  const privateKey = loadPrivateKeyWithoutHeaderFooter(
    path.join(__dirname, "../", "../", "../", "tmp", "keys", privateKeyFilePath)
  );

  console.log(privateKey, "Private Key...");
  const egsUnit = {
    uuid: crypto.randomUUID(),
    custom_id: "EGS1-886431145",
    model: "IOS",
    CRN_number: "301121971500003",
    VAT_name: "My Company",
    VAT_number: "301121971500003",
    location: {
      city: "Riyadh",
      city_subdivision: "Central",
      street: "King Fahad Road",
      plot_identification: "0000",
      building: "0000",
      postal_zone: "12345",
    },
    branch_name: "Main Branch",
    branch_industry: "Retail",
    cancelation: {
      cancelation_type: "INVOICE",
      canceled_invoice_number: "",
    },
  };

  const invoice = {
    invoice_counter_number: 1,
    invoice_serial_number: "EGS1-886431145-1",
    issue_date: "2023-05-15",
    issue_time: "14:30:00",
    previous_invoice_hash: "",
    line_items: [
      {
        id: "1",
        name: "Product 1",
        quantity: 2,
        tax_exclusive_price: 100,
        VAT_percent: 0.15,
        other_taxes: [],
        discounts: [],
      },
    ],
  };

  // 1. Generate keys
  // const keys = generateSecp256k1KeyPair();
  // console.log('Generated keys');

  // 2. Generate CSR
  // const csr = generateCSR('MySolution', keys.privateKey, egsUnit);
  // console.log('Generated CSR');

  // 3. Issue compliance certificate (requires OTP from ZATCA)
  // const { requestId, binarySecurityToken, secret } = await issueComplianceCertificate(csr, '123456');
  // console.log('Issued compliance certificate');

  // 4. Generate invoice XML
  const invoiceXML = generateInvoiceXML(invoice, egsUnit);

  console.log(invoiceXML, "invoiceXML...");

  const base64Invoice = Buffer.from(invoiceXML).toString("base64");

  // console.log(base64Invoice, "Base 64 Invoice");

  // 5. Sign invoice
  const { signedInvoice, invoiceHash, signature } = signInvoice(
    invoiceXML,
    privateKey
  );
  // console.log('Signed invoice');
  console.log(invoiceHash, "invoiceHash...");

  // 6. Generate QR code
  const qrCode = generateQRCode(invoice, egsUnit, signature);
  console.log("Generated QR code:", qrCode);

  const payload = {
    invoiceHash,
    uuid: crypto.randomUUID(),
    invoice: base64Invoice,
  };
  // Access token from onboarding step
  const ACCESS_TOKEN = "YOUR_ACCESS_TOKEN_HERE";

  console.log(payload, "payload");

  // const payload = {
  //   invoice: base64Invoice,
  //   invoiceHash: invoiceHash,
  //   uuid: uuid
  // };

  // axios
  //   .post(API_URL, payload, { headers })
  //   .then((response) => {
  //     console.log(" Invoice cleared successfully:", response.data);
  //   })
  //   .catch((error) => {
  //     console.error(
  //       " Error clearing invoice:",
  //       error.response ? error.response.data : error.message
  //     );
  //   });

  // 7. Check compliance (requires certificate and secret from step 3)
  const complianceResult = await checkInvoiceCompliance(
    payload,
    binarySecurityToken
  );
  console.log("Compliance result:", complianceResult);
}

// main().catch(console.error);

module.exports = { generateNewKeysAndCSR, main };
