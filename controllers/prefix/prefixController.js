const SeriesNumber = require('../../models/seriesnumber');



exports.addPrefixForUser = async (req, res) => {
    const { prefix } = req.body;

    try {
        const series = await SeriesNumber.findOne({ 'companyDetails.companyId': req.companyId });

        if (!series) {
            return res.status(404).json({ message: "SeriesNumber record not found for the company" });
        }

        // Check if the user already has a prefix

        const userIdToCheck = req.userRole.toLowerCase() === 'admin' ? req.user : req.currentUser;

        const userExists = series.prefixes.some((p) => p.userId.toString() === userIdToCheck.toString());
        
        if (userExists) {
            return res.status(400).json({ message: "Prefix already exists for this user" });
        };

  
        // Add new prefix
        series.prefixes.push({ userId: req.userRole.toLowerCase() == 'admin' ? req.user : req.currentUser, prefix });

        await series.save();

        res.status(200).json({ message: "Prefix added successfully", series });
    } catch (error) {
        res.status(500).json({ message: "Error adding prefix", error: error.message });
    }
};