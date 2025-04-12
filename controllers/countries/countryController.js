const Countries = require("../../models/countriesModel");

exports.getAllCountries = async (req, res) => {
  try {
    const countryData = await Countries.find({ createdBy: req.user })
      .select("name code")
      .sort({ name: 1 });

    if (!countryData) {
      return res.status(200).json({ error: "Data not Found!!!!" });
    }

    res.status(200).json(countryData || []);
    // res.status(200).json({ status: "Success", data: countryData });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error });
  }
};
