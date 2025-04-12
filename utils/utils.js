const { parseISO, isValid } = require("date-fns");

function parseDate(dateStr) {
  // saving in utc to avoid issues with timezones
  if (typeof dateStr !== "string") return false;
  const date = parseISO(dateStr);
  return { isValid: isValid(date), date };
}

function parseDocumentNo(documentNo, type) {
  let currentDocumentNo = documentNo.split("-");
  if (isNaN(documentNo)) {
    // strict checking pattern: prefix-123
    if (
      currentDocumentNo.length === 2 &&
      isNaN(currentDocumentNo[0]) &&
      !isNaN(currentDocumentNo[1])
    ) {
      currentDocumentNo = documentNo.split("-")[1];
      if (Number(currentDocumentNo) <= 0) {
        return {
          status: "Failed",
          message: `Enter valid document No`,
        };
      } 
    } else {
      // return {
      //   status: "Failed",
      //   message: `Invalid ${type}. Please use format [prefix]-[documentNo]`,
      // };
    }
  } else {
    // no prefix for admins
    //TODO: check if user is admin before assigning
    if (Number(documentNo) <= 0) {
      return {
        status: "Failed",
        message: `Enter valid document No`,
      };
    }
    currentDocumentNo = documentNo;
  }
  return currentDocumentNo;
}

module.exports = {
  parseDate,
  parseDocumentNo,
};
