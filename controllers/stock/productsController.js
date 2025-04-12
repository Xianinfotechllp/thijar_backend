const Products = require("../../models/productModel");
const Categories = require("../../models/categoryModel");
const Transactions = require("../../models/transactionModel");
const StockAdjustment = require("../../models/itemAdjustments");
const Units = require("../../models/unitModel");
const formatDate = require("../../global/formatDate");
const mongoose = require("mongoose");
const { verifyItemPresence } = require("../../utils/itemUtils");
const UnitConversions = require("../../models/unitConversionModel");
const Godown = require("../../models/stockTransfer/godownModel");
const parseDate = require("../../utils/utils");

const itemTypes = ["service", "product"];
const typeMap = {
  service: "Service",
  product: "Product",
};

exports.getTransactionForItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { type = "" } = req.query;

    const itemTypeQuery = itemTypes.includes(type.toLowerCase())
      ? { type: typeMap[type] }
      : {};

    const ProductList = await Transactions.find({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    })
      .populate({
        path: "reference.documentId",
        match: { "items.itemId": itemId },
        select: "items",
      })
      .populate({
        path: "party",
        select: "name",
      });

    let adjustmentData = await StockAdjustment.find({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
      itemId,
    }).select("-createdAt -__V");

    const filteredTransactions = ProductList.filter(
      (transaction) => transaction.reference?.documentId
    );

    const itemQuantities = filteredTransactions.map((transaction) => {
      const matchingItems = transaction.reference.documentId.items.filter(
        (item) => item.itemId.toString() === itemId
      );


      const totalQuantity = matchingItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      const pricePerUnit =
        matchingItems.length > 0 ? matchingItems[0].price : null;

      let newReference = {
        documentNo: transaction.reference?.documentNumber,
        documentId: transaction.reference?.documentId?._id,
      };

      return {
        transactionId: transaction._id,
        type: transaction.transactionType,
        partyName: transaction.party.name,
        quantity: totalQuantity || null,
        pricePerUnit,
        transactionDate: formatDate(transaction.transactionDate),
        reference: newReference,
        totalAmount: transaction.totalAmount,
        status: transaction.balance > 0 ? "UnPaid" : "Paid",
      };
    });

    if (adjustmentData.length > 0) {
      adjustmentData.map((item) => {
        itemQuantities.push({
          transactionId: item._id,
          type: `${item.action.toUpperCase()} Stock`,
          quantity: item.totalQty,
          totalAmount: 0,
          transactionDate: formatDate(item.adjustmentDate),
          reference: {},

          // in official vyapar app, details set in adjust item is reflected in name column of item transactions
          partyName: item?.details,
          //adding matching keys with product pricePerUnit
          pricePerUnit: item.atPrice,
        });
      });
    }

    // itemQuantities.push(adjustmentData);

    const OpeningStockDetails = await Products.findOne({
      _id: itemId,
      ...itemTypeQuery,
    }).select("stock createdAt updatedAt");

    if (OpeningStockDetails) {
      if (OpeningStockDetails.stock.openingQuantity > 0) {
        let stockDetails = {
          transactionId: null,
          type: `Opening Stock`,
          partyName: "Opening Stock",
          quantity: OpeningStockDetails.stock.openingQuantity,
          totalAmount:
            OpeningStockDetails.stock.openingQuantity *
            OpeningStockDetails.stock.price,
          transactionDate: formatDate(OpeningStockDetails.createdAt),
          reference: {},
        };

        itemQuantities.push(stockDetails);
      }
    }
    let sortedTransactionList = itemQuantities.sort(
      (a, b) => new Date(b.transactionDate) - new Date(a.transactionDate)
    );

    if (sortedTransactionList.length === 0) {
      return res
        .status(200)
        .json({ error: "No transactions found with the specified itemId." });
    };

    res.status(200).json({ status: "Success", data: sortedTransactionList });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "Failed",
      message: "An error occurred while fetching Items. Please try again",
      error: error.message || error,
    });
  }
};

exports.getItemById = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!itemId) {
      return res
        .status(400)
        .json({ status: "Failed", message: "Item Id is required" });
    }

    const ProductList = await Products.find({
      _id: itemId,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    })
      .populate("unit", `name shortName _id`)
      .populate("category", "name")
      .select("-createdAt -updatedAt -godownStock")
      .populate({
        path: "unit",
        select: "name shortName",
      })
      .populate({
        path: "unitConversion",
        select: "baseUnit secondaryUnit conversionRate",
        populate: [
          { path: "baseUnit", select: "name shortName" },
          { path: "secondaryUnit", select: "name shortName" },
        ],
      })
      .populate("taxRate");

    if (!ProductList) {
      return res.status(404).json({ error: "Product not Found!!!!" });
    }

    const formattedStock = ProductList.map((item) => {
      delete item.stock;
      // console.log(item);
      return {
        ...item._doc,
      };
    });

    res.status(200).json({ status: "Success", data: formattedStock });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "Failed",
      message: "An error occurred while fetching Items. Please try again",
      error: error.message || error,
    });
  }
};

exports.getAllItems = async (req, res) => {
  try {
    const { type = "", limit, skip, search } = req.query;

    const itemTypeQuery = itemTypes.includes(type.toLowerCase())
      ? { type: typeMap[type] }
      : {};

    let searchConditions = {
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
      ...itemTypeQuery,
    }

    if (search) {
      const regex = new RegExp(search, "i")
      searchConditions.$or = [{ itemName: { $regex: regex } }]
    };

    const ItemsList = await Products.find(searchConditions)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select("-createdAt -updatedAt -godownStock")
      .populate("category")
      .populate({
        path: "unit",
        select: "name shortName",
      })
      .populate({
        path: "unitConversion",
        select: "baseUnit secondaryUnit conversionRate",
        populate: [
          { path: "baseUnit", select: "name shortName" },
          { path: "secondaryUnit", select: "name shortName" },
        ],
      })
      .populate("taxRate");

    if (!ItemsList) {
      return res.status(200).json({ error: `${typeMap[type]} not Found!!!!` });
    }

    res.status(200).json({ status: "Success", data: ItemsList });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "Failed",
      message: "An error occurred while fetching Items. Please try again",
      error: error.message || error,
    });
  }
};

exports.saveItem = async (req, res) => {
  try {
    let {
      itemName,
      itemHsn,
      category,
      itemCode,
      unit,
      unitConversion,
      mrp,
      salePrice,
      salePriceIncludesTax,
      discountValue,
      discountType,
      purchasePrice,
      purchasePriceIncludesTax,
      openingQuantity,
      stockPrice,
      minStockToMaintain,
      taxRate,
      location,
      godown,
      asOfDate,
      type = "",
    } = req.body;

    const images = [];
    type = type.toLowerCase();

    if (type === "service") {
      purchasePrice = 0;
      purchasePriceIncludesTax = false;
      openingQuantity = 0;
      stockPrice = 0;
      asOfDate = "";
      minStockToMaintain = 0;
      location = "";
    }

    if (type === "product") {
      salePrice = salePrice !== "" ? salePrice : 0;
      purchasePrice = purchasePrice !== "" ? purchasePrice : 0;
      purchasePriceIncludesTax =
        purchasePriceIncludesTax === undefined
          ? false
          : purchasePriceIncludesTax;
      openingQuantity = openingQuantity !== "" ? openingQuantity : 0;
      stockPrice = stockPrice !== "" ? stockPrice : 0;
      asOfDate = asOfDate !== "" ? asOfDate : "";
      minStockToMaintain = minStockToMaintain !== "" ? minStockToMaintain : 0;
      location = location !== "" ? location : "";
    }
    if (asOfDate) {
      const parsedDate = parseDate(asOfDate);

      if (parsedDate.isValid === false) {
        return res.status(409).json({
          status: "Failed",
          message: "Please enter valid asOfDate in format YYYY-MM-DD",
        });
      } else {
        asOfDate = parsedDate.date;
      }
    }

    if (!itemTypes.includes(type)) {
      return res.status(409).json({
        status: "Failed",
        message: "Please enter valid type: product | service",
      });
    }

    if (unit) {
      //only allow one of unit or unitConversion
      unitConversion = null;
    }

    if (req.files && req.files.length > 0) {
      for (const image of req.files) {
        images.push(image.filename);
      }
    }

    category = category ? JSON.parse(category) : [];

    let existingProduct = await Products.findOne({
      itemName: { $regex: new RegExp("^" + itemName.trim() + "$", "i") },
      type: typeMap[type],
      "companyDetails.companyId": req.companyId,
      createdBy: req.user,
    });

    if (existingProduct) {
      return res
        .status(409)
        .json({ status: "Failed", message: "Item Already Exists" });
    }
    if (category.length) {
      for (const data of category) {
        let categoryDetails = await Categories.findOne({
          name: { $regex: new RegExp("^" + data + "$", "i") },
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
        });

        if (!categoryDetails) {
          return res.status(404).json({
            status: "Failed",
            message: `Category - ${data} not Found`,
          });
        } else if (categoryDetails) {
          let index = category.indexOf(data);
          category[index] = categoryDetails._id;
        }
      }
    }


    // return

    // let existingCategory = await Categories.findOne({
    //     _id: category,
    //     createdBy: req.user
    // });

    // if (!existingCategory) {
    //     return res.status(404).json({ status: "Failed", message: 'Category Not Found' });
    // }

    godown = godown || null;
    if (godown) {
      let existingGodown = await Godown.findOne({
        _id: godown,
        companyId: req.companyId,
        createdBy: req.user,
      });

      if (!existingGodown) {
        return res
          .status(404)
          .json({ status: "Failed", message: "Godown Not Found" });
      }
    }

    unit = unit || null;

    if (unit) {
      let existingUnit = await Units.findOne({
        _id: unit,
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      });

      if (!existingUnit) {
        return res
          .status(404)
          .json({ status: "Failed", message: "Unit Not Found" });
      }
    } else {
      unitConversion = unitConversion || null;
      if (unitConversion) {
        let existingUnit = await UnitConversions.findOne({
          _id: unitConversion,
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
        });

        if (!existingUnit) {
          return res
            .status(404)
            .json({ status: "Failed", message: "Unit Conversion Not Found" });
        }
      }
    }

    let totalQuantity = openingQuantity ? openingQuantity : 0;

    // Prepare stock details
    const stockDetails = {
      openingQuantity,
      price: stockPrice,
      minStockToMaintain,
      saleQuantity: 0,
      location,
      totalQuantity,
      asOfDate,
    };

    mrp = !mrp ? 0 : mrp;

    taxRate = taxRate ? taxRate : null;

    const allGodowns = await Godown.find({
      companyId: req.companyId,
      createdBy: req.user,
    });

    const godownStockDetails = [];

    // Prepare godownStock details for each godown
    for (const godown of allGodowns) {
      if (
        godown.isMain &&
        godown._id.toString() === req.mainGodownId.toString()
      ) {
        godownStockDetails.push({
          godownId: godown._id,
          quantity: totalQuantity,
        });
      } else {
        // Other godowns get 0 quantity
        godownStockDetails.push({
          godownId: godown._id,
          quantity: 0,
        });
      }
    }

    //now adding main godown and the quanity also in it
    const newProduct = await Products.create({
      type: typeMap[type],
      itemName,
      itemHsn,
      category,
      itemCode,
      unit,
      unitConversion,
      mrp,
      salePrice,
      salePriceIncludesTax,
      discountValue,
      discountType,
      purchasePrice,
      purchasePriceIncludesTax,
      stock: stockDetails,
      taxRate,
      image: images,

      // godownStock: [
      //     {
      //         godownId: req.mainGodownId,
      //         quantity: totalQuantity
      //     }
      // ],
      godown,
      godownStock: godownStockDetails,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });

    // if (newProduct) {
    //     let addingToMainGodown = await addStockToMainGodown(newProduct._id, totalQuantity, req.mainGodownId);

    //     console.log(addingToMainGodown, 'Main Godown');
    // };

    if (newProduct) {
      res.status(201).json({
        status: "Success",
        message: "Item Saved Successfully",
        data: newProduct,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "Failed",
      message: "An error occurred while saving the item. Please try again",
      error: error.message || error,
    });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    let {
      itemName,
      itemHsn,
      category,
      itemCode,
      unit,
      salePrice,
      salePriceIncludesTax,
      discountValue,
      discountType,
      purchasePrice,
      purchasePriceIncludesTax,
      openingQuantity,
      stockPrice,
      minStockToMaintain,
      taxRate,
      location,
      mrp,
      unitConversion,
    } = req.body;

    if (unit) {
      //only allow one of unit or unitConversion
      unitConversion = null;
    } else if (unitConversion) {
      unit = null;
    }

    category = category ? JSON.parse(category) : [];
    discountValue = discountValue ? discountValue : 0;
    unit = unit ? unit : null;
    taxRate = taxRate ? taxRate : null;

    const images = [];

    if (req.files && req.files.length > 0) {
      for (const image of req.files) {
        const imagePath = image.path
          .replace(image.destination, "images/")
          .replace(/\\/g, "/");
        images.push(imagePath);
      }
    }

    let product = await Products.findOne({
      _id: itemId,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });
    if (!product) {
      return res
        .status(404)
        .json({ status: "Failed", message: "Item not found" });
    }

    if (unit) {
      let existingUnit = await Units.findOne({
        _id: unit,
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      });

      if (!existingUnit) {
        return res
          .status(404)
          .json({ status: "Failed", message: "Unit Not Found" });
      }
    } else {
      unitConversion = unitConversion || null;
      if (unitConversion) {
        let existingUnit = await UnitConversions.findOne({
          _id: unitConversion,
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
        });

        if (!existingUnit) {
          return res
            .status(404)
            .json({ status: "Failed", message: "Unit Conversion Not Found" });
        }
      }
    }

    // if (unit) {
    //   console.log(unit, "Unit");
    //   let existingUnit = await Units.findOne({
    //     _id: unit,
    //     createdBy: req.user,
    //     "companyDetails.companyId": req.companyId,
    //   });

    //   if (!existingUnit) {
    //     return res
    //       .status(404)
    //       .json({ status: "Failed", message: "Unit Not Found" });
    //   }
    // }

    if (category.length) {
      for (const data of category) {
        let categoryDetails = await Categories.findOne({
          name: { $regex: new RegExp("^" + data + "$", "i") },
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
        });

        if (!categoryDetails) {
          return res.status(404).json({
            status: "Failed",
            message: `Category - ${data} not Found`,
          });
        } else if (categoryDetails) {
          let index = category.indexOf(data);
          category[index] = categoryDetails._id;
        }
      }
    }

    const stockDetails = {
      openingQuantity: openingQuantity || product.stock.openingQuantity,
      totalQuantity: openingQuantity || product.stock.totalQuantity,

      price: stockPrice || product.stock.price,
      minStockToMaintain:
        minStockToMaintain || product.stock.minStockToMaintain,
      location: location || product.stock.location,
    };

    product.itemName = itemName || product.itemName;
    product.itemHsn = itemHsn || product.itemHsn;
    product.category = category || product.category;
    product.itemCode = itemCode || product.itemCode;
    product.unit = unitConversion ? null : unit || product.unit;
    product.unitConversion = unit
      ? null
      : unitConversion || product.unitConversion;
    product.salePrice = salePrice || product.salePrice;
    product.salePriceIncludesTax =
      salePriceIncludesTax !== undefined
        ? salePriceIncludesTax
        : product.salePriceIncludesTax;
    product.discount.value =
      discountValue !== undefined ? discountValue : product.discount.value;
    product.discount.type = discountType || product.discount.type;
    product.purchasePrice = purchasePrice || product.purchasePrice;
    product.purchasePriceIncludesTax =
      purchasePriceIncludesTax !== undefined
        ? purchasePriceIncludesTax
        : product.purchasePriceIncludesTax;
    product.stock = stockDetails;
    product.taxRate = taxRate || product.taxRate;
    product.mrp = mrp || product.mrp;
    product.image = images || product.image; // If new images provided, update; otherwise, keep existing
    product.stock.saleQuantity = 0;

    const godownIndex = product.godownStock.findIndex(
      (stock) => stock.godownId.toString() === req.mainGodownId.toString()
    );

    if (godownIndex !== -1) {
      // If a matching godown exists, update its quantity
      product.godownStock[godownIndex].quantity =
        openingQuantity || product.stock.totalQuantity;
    }

    // Save updated product
    await product.save();

    return res.status(200).json({
      status: "Success",
      message: "Item updated successfully",
      data: product,
    });
  } catch (error) {
    console.log(error, "Errrorerorrr");
    res.status(500).json({
      status: "Failed",
      message: "An error occurred while updating the item. Please try again.",
      error: error.message || error,
    });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    // Validate if partyId is provided
    if (!itemId) {
      return res
        .status(400)
        .json({ status: "Failed", message: "Party ID is required" });
    }

    const findProduct = await Products.findById(itemId);

    if (!findProduct) {
      return res
        .status(404)
        .json({ status: "Failed", message: "Item Not Found" });
    };

    //If Item already present in any transaction, then it cannot be deleted
    const checkItemInTransactions = await verifyItemPresence(itemId, req.user, req.companyId);

    if (checkItemInTransactions) {
      return res.status(200).json({ message: "Failed", reason: "Item is already present in a transaction. Please delete this Item from Transaction First" });
    };

    await Products.findByIdAndDelete(itemId);

    res
      .status(200)
      .json({ status: "Success", message: "Item Deleted Successfully" });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "Failed",
      message: "An error occurred while deleting the item. Please try again.",
      error: error.message || error,
    });
  }
};

const Party = require("../../models/partyModel");
exports.seedParty = async (req, res) => {
  try {
    const createdBy = new mongoose.Types.ObjectId("67a1b22611ff178298e68017");
    const companyId = new mongoose.Types.ObjectId("67a1b22611ff178298e68019");

    let parties = [];
    for (let i = 0; i < 10000; i++) {
      parties.push({
        name: `Party ${i + 1}`,
        gstIn: `22ABCDE${(i % 1000).toString().padStart(3, "0")}F1Z5`, // Fixed GST pattern
        gstType: "Registered Business-Regular",
        contactDetails: {
          email: `party${i + 1}@example.com`,
          phone: `98765432${(i % 10).toString().padStart(2, "0")}`,
        },
        billingAddress: `Billing Address ${i + 1}`,
        shippingAddress: `Shipping Address ${i + 1}`,
        openingBalanceDetails: {
          openingBalance: 10000, // Static value
          date: new Date("2025-01-01"),
          balanceType: "toReceive",
        },
        creditLimit: 50000, // Static value
        balanceDetails: {
          receivableBalance: 25000, // Static value
          payableBalance: 0, // Static value
        },
        receivedAmount: 5000, // Static value
        paidAmount: 0, // Static value
        createdBy,
        companyDetails: {
          companyId,
          userId: null,
        },
      });

      // Insert in batches of 1000
      if (parties.length === 1000 || i === 9999) {
        await Party.insertMany(parties);
        console.log(`Inserted ${i + 1} parties`);
        parties = [];
      }

      console.log("Seeding complete!");
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.seedProducts = async (req, res) => {
  try {
    // Constants for seeding
    const unitId = new mongoose.Types.ObjectId("67a1b22711ff178298e68035");
    const createdBy = new mongoose.Types.ObjectId("67a1b22611ff178298e68017");

    let products = [];
    for (let i = 0; i < 10000; i++) {
      products.push({
        type: "Product",
        itemName: `Sample Product ${i + 1}`,
        itemHsn: `HSN${1000 + i}`,
        category: [],
        itemCode: `CODE${10000 + i}`,
        unit: unitId,
        salePrice: Math.floor(Math.random() * 500) + 100,
        purchasePrice: Math.floor(Math.random() * 400) + 50,
        stock: {
          openingQuantity: Math.floor(Math.random() * 50),
          saleQuantity: Math.floor(Math.random() * 10),
          purchaseQuantity: Math.floor(Math.random() * 30),
          totalQuantity: Math.floor(Math.random() * 100),
          minStockToMaintain: 5,
        },
        isActive: true,
        companyDetails: {
          companyId: new mongoose.Types.ObjectId(), // Dummy company ID
          userId: null,
        },
        createdBy,
      });

      // Insert in batches of 1000 to optimize performance
      if (products.length === 1000 || i === 9999) {
        await { Products }.insertMany(products);
        console.log(`Inserted ${i + 1} products`);
        products = [];
      }
    }

    console.log("Seeding complete!");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
