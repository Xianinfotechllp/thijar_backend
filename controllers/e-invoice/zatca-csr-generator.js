const crypto = require('crypto');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const businessProfile = require("../../models/businessProfile")

function generateNewKeysAndCSR(solutionName, egsInfo, isProduction = false) {
  const privateKey = generateSecp256k1KeyPair();
  const csr = generateCSR(solutionName, privateKey, egsInfo, isProduction);
  const csrBase64 = Buffer.from(csr).toString('base64');
  return [privateKey, csr, csrBase64];
}

function generateSecp256k1KeyPair() {
  try {
    const result = execSync('openssl ecparam -name secp256k1 -genkey').toString();
    const parts = result.split('-----BEGIN EC PRIVATE KEY-----');

    if (!parts[1]) throw new Error('No private key found in OpenSSL output.');

    const keyContent = parts[1].trim();
    return `-----BEGIN EC PRIVATE KEY-----\n${keyContent}`.trim();
  } catch (error) {
    throw new Error(`Failed to generate key pair: ${error.message}`);
  }
}

function generateCSR(solutionName, privateKey, egsInfo, isProduction) {
  if (!privateKey) throw new Error('EGS has no private key');

  const tmpDir = path.join(__dirname, "../", "../", "tmp");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true, mode: 0o775 });
  }
  console.log(tmpDir, "TMp dir")
  const privateKeyFileName = path.join(tmpDir, `${uuid()}.pem`);
  const csrConfigFileName = path.join(tmpDir, `${uuid()}.cnf`);

  try {
    // Write private key to file
    fs.writeFileSync(privateKeyFileName, privateKey);

    // Generate CSR config
    const csrConfig = `[req]
prompt = no
utf8 = no
distinguished_name = my_req_dn_prompt
req_extensions = v3_req

[v3_req]



1.3.6.1.4.1.311.20.2 = ASN1:UTF8String:${isProduction ? 'ZATCA-Code-Signing' : 'TSTZATCA-Code-Signing'}
subjectAltName=dirName:dir_sect

[dir_sect]
SN = 1-${solutionName}|2-${egsInfo.model}|3-${egsInfo.uuid}
UID = ${egsInfo.VAT_number}
title = 0100
registeredAddress = ${egsInfo.location.building} ${egsInfo.location.street}, ${egsInfo.location.city}
businessCategory = ${egsInfo.branch_industry}

[my_req_dn_prompt]
commonName = ${egsInfo.custom_id}
organizationalUnitName = ${egsInfo.branch_name}
organizationName = ${egsInfo.VAT_name}
countryName = SA`;

    fs.writeFileSync(csrConfigFileName, csrConfig);

    // Generate CSR
    const result = execSync(
      `openssl req -new -sha256 -key "${privateKeyFileName}" -config "${csrConfigFileName}"`,
      { stdio: ['ignore', 'pipe', 'pipe'] }
    ).toString();

    const parts = result.split('-----BEGIN CERTIFICATE REQUEST-----');
    if (!parts[1]) throw new Error('Failed to generate CSR - no CSR found in output');

    return `-----BEGIN CERTIFICATE REQUEST-----${parts[1]}`.trim();
  } catch (error) {
    console.error('CSR Generation Error:', error.message);
    if (error.stderr) console.error('OpenSSL Error:', error.stderr.toString());
    throw new Error(`CSR generation failed: ${error.message}`);
  } finally {
    // Clean up temporary files
    try {
      // [privateKeyFileName, csrConfigFileName].forEach(f => {
      [csrConfigFileName].forEach(f => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }
  }
}

function uuid() {
  return crypto.randomUUID();
}

// Example usage with sample data
const egsInfo = {
  model: 'EGS-Model',
  uuid: crypto.randomUUID(),
  VAT_number: '300000000000003',
  location: {
    building: 'Commercial Building',
    street: 'Main Street',
    city: 'Riyadh'
  },
  branch_industry: 'Retail',
  branch_name: 'Main Branch',
  VAT_name: 'Taxpayer Company Name',
  custom_id: 'TP-123456'
};


module.exports={generateNewKeysAndCSR}
// Generate keys, CSR, and Base64 encoded CSR
try {
  const [privateKey, csr, csrBase64] = generateNewKeysAndCSR('QR-Solution', egsInfo, true);

  console.log('Successfully generated:');
  console.log('\nPrivate Key:');
  console.log(privateKey);

  console.log('\nCSR:');
  console.log(csr);

  console.log('\nBase64 Encoded CSR:');
  console.log(csrBase64);

  // Verify the CSR
  console.log('\nCSR Details:');
  // const verification = execSync(`openssl req -in - -noout -text`, { input: csr }).toString();
  // console.log(verification);

} catch (error) {
  console.error('Generation failed:', error.message);
}