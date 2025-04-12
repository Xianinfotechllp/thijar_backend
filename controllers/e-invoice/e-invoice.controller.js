const BusinessProfile = require("../../models/businessProfile");
const { generateNewKeysAndCSR, main } = require("./services/cryptoService");
const {
  callComplianceCSID,
  reportInvoiceToZATCA,
} = require("./services/zatcaService");

exports.generateEInvoice = async (req, res) => {
  const userId = req.user;

  const profile = await BusinessProfile.findOne({ createdBy: userId });

  if (!profile)
    return res.status(404).json({ message: "Business profile not found" });

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

  // // If no private key exists, assume fresh onboarding
  if (!profile.privateKeyPath && profile.onboardingStatus != "COMPLETED") {
    console.log("here");
    const { privateKeyFileName, privateKey, csr, csrBase64 } =
      await generateNewKeysAndCSR("QR-Solution", egsInfo, true);
    console.log(privateKey, "privateKey");
    const { token, certificate, secret, requestID } = await callComplianceCSID(
      csrBase64
    );

    profile.privateKeyPath = privateKeyFileName;
    profile.binarySecurityToken = token;
    profile.certificate = certificate;
    profile.complianceCSIDSecret = secret;
    profile.onboardingStatus = "COMPLETED";
    profile.requestID = requestID;

    await profile.save();
  }
  await main(
    profile.privateKeyPath,
    profile.binarySecurityToken
  );
  return;

  // Now move to invoice signing + reporting
  const signedInvoice = "<your-xml-or-json-signed-invoice>";
  const response = await reportInvoiceToZATCA(
    profile.binarySecurityToken,
    signedInvoice
  );

  return res
    .status(200)
    .json({ message: "Invoice reported", zatcaResponse: response });
};
