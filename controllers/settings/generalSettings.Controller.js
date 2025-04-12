const GeneralSettings = require("../../models/settings/generalSettingsModel");


exports.getGeneralSettings = async (req, res) => {
    try {

        const generalSettings = await GeneralSettings.findOne({ createdBy: req.user, "companyDetails.companyId": req.companyId });

        if (!generalSettings) {
            return res.status(404).json({ message: "General Settings Not found for the user" });
        };

        res.status(200).json({ status: "Success", data: generalSettings })

    } catch (error) {
        res.status(500).json({
            message: "Internal Server Error",
            error: error.message || error,
        });
    }
};

exports.handleGeneralSettings = async (req, res) => {
    try {
        let {
            selectedLanguage,
            currencyDenomination,
            enablePassword,
            dateFormat,
            enableMultiFirm,
            enableStockTransfer,
        } = req.body;

        const booleanFields = {
            enablePassword: "Enable Password Value must be a boolean.",
            enableMultiFirm: "Enable Multi Firm Value must be a boolean.",
            enableStockTransfer: "Enable Stock Transfer Value must be a boolean.",
        };


        for (const [field, errorMessage] of Object.entries(booleanFields)) {
            if (req.body[field] && typeof req.body[field] !== "boolean") {
                return res
                    .status(400)
                    .json({ status: "Failed", message: errorMessage });
            }
        };

        let payload ={};
        payload.general=req.body;

        let updatedGeneralSettings = await GeneralSettings.findOneAndUpdate(
            {
                createdBy: req.user,
                "companyDetails.companyId": req.companyId,
            },
            payload
        );

        if (!updatedGeneralSettings) {
            throw new Error(`Error Updating General Settings`);
        };

        res.status(200).json({
            status: "Success",
            message: "General Settings Updated Successfully",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Internal Server Error",
            error: error.message || error,
        });
    }
};
