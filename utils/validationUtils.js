
const validatePaymentMethods = (paymentMethod, res) => {
    if (paymentMethod.length > 0) {
        for (const payment of paymentMethod) {
            // Validate payment method
            if (!["Cash", "Credit", "Cheque", "Bank"].includes(payment.method)) {
                return res.status(400).json({
                    status: "Failed",
                    message: `Invalid payment method. Allowed values are 'Cash', 'Cheque', or 'Bank'.`
                });
            }

            // Validate bank name for 'Bank' method
            if (payment.method === "Bank" && !payment.bankName) {
                return res.status(400).json({
                    status: "Failed",
                    message: `Bank name is required when the payment method is 'Bank'.`
                });
            }

            // Validate payment amount
            if (payment.amount <= 0 || !payment.amount) {
                return res.status(400).json({
                    status: "Failed",
                    message: `Payment amount must be greater than zero.`
                });
            }


            if (!['Bank'].includes(payment.method)) {

                delete payment.bankName
            }
        }
    }
    return true;
};


const validateTransactionAmounts = ({ total, receivedOrPaid, balance, type = "received", itemSettings }) => {
    const decimal = itemSettings?.commonDecimalPlaces ?? 2;

    // Function to round values properly
    const roundToDecimal = (value) => Math.round(value * Math.pow(10, decimal)) / Math.pow(10, decimal);

    const totalAmount = roundToDecimal(total);
    const receivedAmount = roundToDecimal(receivedOrPaid);
    const balanceAmount = roundToDecimal(balance);
    const expectedBalance = roundToDecimal(totalAmount - receivedAmount);

    if (receivedAmount > totalAmount) {
        return `${type} amount cannot be greater than total amount.`;
    }

    if (receivedAmount === totalAmount && balanceAmount !== 0) {
        return "Balance amount should be 0 if total amount is fully paid.";
    }

    if (receivedAmount < totalAmount && balanceAmount !== expectedBalance) {
        return "Balance amount does not match the expected value.";
    }

    return null;
};


module.exports = { validatePaymentMethods, validateTransactionAmounts };
