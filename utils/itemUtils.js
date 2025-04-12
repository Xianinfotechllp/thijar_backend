const Units = require("../models/unitModel");
const Products = require("../models/productModel");
const Godowns = require("../models/stockTransfer/godownModel");



const DebitNotes = require("../models/purchase/debitNoteModel");
const Purchase = require("../models/purchase/purchaseModel");
const PurchaseOrders = require("../models/purchase/purchaseOrderModel");
const SaleOrders = require("../models/saleOrderModel");
const Sales = require("../models/invoiceModel");
const CreditNotes = require("../models/crnModel");

const processItems = async (items, userId, companyId, mainGodownId, session) => {
    try {
        for (const item of items) {
            // Checking if the unit exists or not
            let existingUnit = await Units.findOne({ name: item.unit, createdBy: userId, 'companyDetails.companyId': companyId });

            if (!existingUnit) {
                console.log(`Unit Not Found for ${item.unit}`);
                throw new Error('Unit not found');
            } else {
                item.unit = existingUnit._id;
            };

            // Checking if the item exists (if not, create a new one)
            let existingItem = await Products.findOne({
                itemName: { $regex: new RegExp("^" + item.name + "$", "i") },
                createdBy: userId,
                'companyDetails.companyId': companyId
            });

            if (!existingItem) {
                console.log(`Item not found: ${item.name}`);

                let itemName = item.name;

                const allGodowns = await Godowns.find({ companyId: companyId, createdBy: userId });

                const godownStockDetails = [];

                // Prepare godownStock details for each godown
                for (const godown of allGodowns) {
                    if (godown.isMain && godown._id.toString() === mainGodownId.toString()) {
                        godownStockDetails.push({
                            godownId: godown._id,
                            quantity: 0,//In Item utils im adding 0 quantity
                        });
                    } else {
                        godownStockDetails.push({
                            godownId: godown._id,
                            quantity: 0, // Other godowns get 0 quantity
                        });
                    }
                };

                const saveItem = await Products.create([{
                    itemName,
                    stock: { price: item?.price || 0 },
                    godownStock: godownStockDetails,
                    salePrice: item?.price || 0,
                    createdBy: userId,
                    'companyDetails.companyId': companyId
                }], { session });



                if (!saveItem) {
                    throw new Error('Error during saving new Item');
                }

                console.log('New Item saved:', saveItem);
                item.itemId = saveItem[0]._id;


            } else {
                item.itemId = existingItem._id;

            }

            item.taxPercent = item.taxPercent ? item.taxPercent : null;
            delete item.name;
        }

        return items;
    } catch (error) {
        console.error('Error processing items:', error);
        throw new Error('Error processing items:' + error);
    }
};


const addStockToMainGodown = async (productId, quantity, godownId) => {
    await Products.updateOne(
        { _id: productId, "godownStock.godownId": godownId },
        { $inc: { "godownStock.$.quantity": quantity } },
        { upsert: true }
    );
};




const findGodown = async (godownName, companyId, userId, session) => {

    let godownDetails = await Godowns.findOne({ name: godownName, companyId, createdBy: userId });

    if (!godownDetails) {

        throw new Error('Godown Not Found!!!');
    };

    return godownDetails._id;
};



const verifyItemPresence = async (itemId, userId, companyId) => {
    try {

        const models = [Sales, Purchase, DebitNotes, CreditNotes, PurchaseOrders, SaleOrders];

        for (const model of models) {
            const document = await model.findOne({
                createdBy: userId,
                'companyDetails.companyId': companyId,
                "items.itemId": itemId
            });
            if (document) {
                console.log(`Item found in ${model.modelName}`);
                return true;
            };
        };

        console.log("Item not found in any Transaction.");
        return false;
    } catch (error) {

        throw new Error("Error checking item presence:" + error);
    }
};

module.exports = { processItems, addStockToMainGodown, findGodown, verifyItemPresence };
