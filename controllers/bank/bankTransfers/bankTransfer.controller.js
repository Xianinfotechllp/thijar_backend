const Banks = require("../../../models/bankModel");
const Parties = require("../../../models/partyModel");
const BankTransfers = require("../../../models/bankTransferModel");

const transferTypes = ['bank_to_cash', 'cash_to_bank', 'bank_to_bank', 'bank_to_party'];
const destinationTypes = ['cash', 'bank', 'party'];

const validTransfers = {
    "bank_to_cash": "Cash",
    "cash_to_bank": "Bank",
    "bank_to_bank": "Bank",
    "bank_to_party": "Party"
};

const findBank = async (bankName, userId, companyId) => {
    const BankDetails = await Banks.findOne({ bankName, createdBy: userId, "companyDetails.companyId": companyId });

    return BankDetails?._id;
};

const findParty = async (partyName, userId, companyId) => {
    const PartyDetails = await Parties.findOne({ name: partyName, createdBy: userId, "companyDetails.companyId": companyId });

    return PartyDetails?._id;
};

exports.addBankTransfer = async (req, res) => {

    try {
        let { transferType, transactionType, transferDate, source, destination, destinationType, amount, description } = req.body;

        // Currently, not adding complete logic for bank-to-party transfers
        if (transferType === "bank_to_party") {
            return res.status(200).json({ message: "Bank to Party transfer functionality is under development and will be added soon." });
        }

        // Validation for transferType
        if (!transferTypes.includes(transferType)) {
            return res.status(400).json({ status: "Failed", message: "Enter Valid Transfer Type." });
        };

        // Validate transactionType
        if (!transactionType || !['withdraw', 'deposit'].includes(transactionType.toLowerCase())) {
            return res.status(400).json({ status: "Failed", message: "Enter Valid Transaction Type" });
        };

        // Ensuring correct transaction type for specific transfer types
        if (['bank_to_cash', 'bank_to_party'].includes(transferType) && transactionType.toLowerCase() !== 'withdraw') {
            return res.status(400).json({ status: "Failed", message: "Enter Valid Transaction Type." });
        };

        // Validate destinationType
        if (!destinationTypes.includes(destinationType.toLowerCase())) {
            return res.status(400).json({ status: "Failed", message: "Enter Valid Destination Type" });
        };

        // Validate destinationType based on transferType
        if (destinationType !== validTransfers[transferType]) {
            return res.status(400).json({
                message: `Invalid destinationType. Expected '${validTransfers[transferType]}' for transferType '${transferType}'.`
            });
        };

        // Converting transactionType to 'debit' or 'credit'
        transactionType = transactionType.toLowerCase() === "withdraw" ? "debit" : "credit";



        let sourceBank = null;
        let destinationBank = null;
        let destinationParty = null;
        let isCashDestination = false;


        // Validate source (bank or cash)
        if (source.toLowerCase() !== "cash") {
            sourceBank = await findBank(source, req.user, req.companyId);
            if (!sourceBank) {
                return res.status(400).json({ message: "Bank not found (Source)!!" });
            }
        }

        // Validate destination
        if (transferType === "bank_to_bank") {
            destinationBank = await findBank(destination, req.user, req.companyId);
            if (!destinationBank) {
                return res.status(400).json({ message: "Bank not found (Destination)!!" });
            }
        } else if (transferType === "cash_to_bank") {
            destinationBank = await findBank(destination, req.user, req.companyId);
            if (!destinationBank) {
                return res.status(400).json({ message: "Bank not found (Destination)!!" });
            }
        } else if (transferType === "bank_to_party") {
            destinationParty = await findParty(destination, req.user, req.companyId);
            if (!destinationParty) {
                return res.status(400).json({ message: "Party not found!!" });
            }
        } else if (transferType === "bank_to_cash") {
            isCashDestination = true;
        }


        let image = "";

        // Image validation
        if (req.files && req.files.length > 0) {
            const validImages = req.files.filter(file => ["image/png", "image/jpg", "image/jpeg"].includes(file.mimetype));
            if (validImages.length > 0) {
                image = validImages[0].filename;
            };
        };

        // Create a new bank transfer entry
        const newBankTransfer = new BankTransfers({
            transferType,
            transactionType,
            transferDate,
            source: sourceBank,
            destinationBank,
            destinationParty,
            isCashDestination,
            amount: +amount,
            description,
            image,
            createdBy: req.user,
            companyDetails: {
                companyId: req.companyId
            }
        });


        await newBankTransfer.save();

        return res.status(201).json({ status: "Success", message: "Bank Transfer Added Successfully", data: newBankTransfer });
    } catch (err) {
        res.status(500).json({ message: "Internal Server Error!", error: err.message || err });
    }
};
exports.getBankTransferById = async (req, res) => {
    try {
        const { transferId } = req.params;
        const bankTransfer = await BankTransfers.findById(transferId);

        if (!bankTransfer) {
            return res.status(404).json({ status: "Failed", message: "Bank Transfer not found" });
        }

        // Populate relevant fields based on the new schema
        let populateOptions = [];

        if (bankTransfer.source) {
            populateOptions.push({ path: "source", select: "bankName", model: "Banks" });
        }

        if (bankTransfer.destinationBank) {
            populateOptions.push({ path: "destinationBank", select: "bankName", model: "Banks" });
        } else if (bankTransfer.destinationParty) {
            populateOptions.push({ path: "destinationParty", select: "name", model: "Party" });
        }

        // Execute population if required
        if (populateOptions.length > 0) {
            await bankTransfer.populate(populateOptions);
        }

        res.status(200).json({ status: "Success", data: bankTransfer });

    } catch (err) {
        res.status(500).json({ status: "Failed", message: "Internal Server Error", error: err.message });
    }
};

exports.getAllBankTransfers = async (req, res) => {
    try {

        const bankTransfers = await BankTransfers.find({ createdBy: req.user, "companyDetails.companyId": req.companyId }).select("-createdBy -companyDetails");

        res.status(200).json({ status: "Success", data: bankTransfers });

    } catch (err) {
        res.status(500).json({ status: "Failed", message: "Internal Server Error", error: err.message });
    }
};


