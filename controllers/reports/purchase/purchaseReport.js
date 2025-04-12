const Transactions = require("../../../models/transactionModel");
const Parties = require("../../../models/partyModel");
const formatDate = require("../../../global/formatDate")

exports.getTransactionReport = async (req, res) => {
    try {

        let { fromDate, toDate, transactionType, partyName } = req.query;

        partyName = partyName ? partyName : 'All Party';

        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: "fromDate and toDate are required" })
        };

        // Convert to date objects and format if needed
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);


        let searchOptions = {
            transactionDate: {
                $gte: startDate,
                $lte: endDate
            },
            transactionType: {
                $in: ['Purchase', 'Debit Note']
            },
            createdBy: req.user,
            'companyDetails.companyId': req.companyId,
        };

        if (transactionType &&
            transactionType?.toUpperCase()?.trim() !== 'ALL TRANSACTIONS') {

            if (transactionType.toLowerCase().trim() == "purchase and dr. note") {

                console.log(`dR nOTESD`)
                searchOptions.transactionType = {
                    $in: ['Purchase', 'Debit Note']
                }
            }
            else {
                searchOptions.transactionType = {
                    $in: [transactionType]
                }
            }

        };

        if (partyName &&
            partyName?.trim()?.toUpperCase() !== "ALL PARTY"
        ) {

            let partyId;

            // if (partyName !== 'All Party') {
            let PartyDetails = await Parties.findOne({
                createdBy: req.user,
                'companyDetails.companyId': req.companyId,
                name: partyName
            });

            if (!PartyDetails) {
                return res.status(400).json({ status: "Failed", message: "Party Not Found" });
            };

            partyId = PartyDetails._id;
            searchOptions.party = partyId;
            // }
        }

        console.log(searchOptions, 'Search Optons');

        let TransactionList = await Transactions.find(searchOptions).select(`transactionDate reference.documentNumber transactionType totalAmount debit_amount credit_amount balance`)
            .populate('party', 'name')
            .sort({ transactionDate: 1 });

        let totalAmount = 0;
        let totalBalanceAmount = 0;

        if (TransactionList) {
            TransactionList = TransactionList.map(transaction => {
                totalAmount += transaction.totalAmount;
                totalBalanceAmount += transaction.balance;
                return {
                    ...transaction._doc,
                    transactionDate: formatDate(transaction.transactionDate)

                };
            });
        };


        let response = {
            status: 'Success', TransactionList,
            totalTransactions: TransactionList.length,
            totalAmount: parseFloat(totalAmount).toFixed(2),
            balanceDue: parseFloat(totalBalanceAmount).toFixed(2)
        }
        return res.status(200).json(response);

    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}