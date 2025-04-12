const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { exec } = require("child_process");
const { Console } = require('console');
const os = require("os");
// exports.generatBackup = async (req, res) => {
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const userId = req.user;
//         const collections = await mongoose.connection.db.listCollections().toArray();
//         let backupData = {};
//         let userSpecifiedCollections = [];

//         for (const collection of collections) {
//             userSpecifiedCollections.push(collection.name);
//         };

//         for (let collection of collections) {
//             const collectionName = collection.name;
//             const rawCollection = mongoose.connection.db.collection(collectionName);

//             let query = {};
//             const staticCollections = ['businessCategories', 'states', 'countries'];

//             if (collectionName === 'users') {
//                 query = { _id: new mongoose.Types.ObjectId(userId) };
//             } else if (staticCollections.includes(collectionName)) {
//                 query = {};
//             } else {
//                 query = { createdBy: new mongoose.Types.ObjectId(userId) };
//             };

//             const userData = await rawCollection.find(query, { session }).toArray();
//             backupData[collectionName] = userData;
//         }

//         if (Object.values(backupData).every(data => data.length === 0)) {
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(404).json({ message: 'No data found for backup' });
//         }

//         // Create a backup file
//         const backupFolder = path.join(__dirname, 'backups');
//         if (!fs.existsSync(backupFolder)) fs.mkdirSync(backupFolder);

//         const filePath = path.join(backupFolder, `backup_${userId}_${Date.now()}.json`);
//         fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

//         await session.commitTransaction();
//         session.endSession();


//         res.download(filePath, `backup_${userId}.json`, (err) => {
//             if (err) {
//                 console.error('Download error:', err);
//                 res.status(500).json({ message: 'Backup download failed' });
//             }
//             setTimeout(() => fs.unlinkSync(filePath), 5000);
//         });

//     } catch (err) {
//         await session.abortTransaction();
//         session.endSession();
//         console.error('Backup failed:', err);
//         res.status(500).json({ message: 'Backup failed', error: err });
//     }
// };



// exports.restoreBackup = async (req, res) => {
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

//         const userId = new mongoose.Types.ObjectId(req.user); // Ensure ObjectId
//         let jsonData;

//         try {
//             jsonData = JSON.parse(req.file.buffer.toString());
//             if (typeof jsonData !== 'object' || Object.keys(jsonData).length === 0) {
//                 return res.status(400).json({ message: 'Invalid backup file' });
//             }
//         } catch (error) {
//             return res.status(400).json({ message: 'Malformed JSON in backup file' });
//         }

//         const staticCollections = ['businessCategories', 'states', 'countries'];

//         for (let [collectionName, data] of Object.entries(jsonData)) {
//             const model = mongoose.connection.collection(collectionName);


//             if (!Array.isArray(data)) {
//                 console.error(`Skipping ${collectionName}: Invalid data format`);
//                 continue;
//             }


//             let deleteQuery = {};
//             if (collectionName === 'users') {
//                 deleteQuery = { _id: userId };
//             } else if (!staticCollections.includes(collectionName)) {
//                 deleteQuery = { createdBy: userId };
//             }


//             await model.deleteMany(deleteQuery, { session });

//             const sanitizedData = data.map(record => {
//                 const { _id, createdAt, updatedAt, ...safeData } = record;
//                 if (collectionName == 'users') {
//                     return {
//                         _id,
//                         ...safeData,
//                         createdAt: new Date(),
//                         updatedAt: new Date(),
//                     };
//                 } else {
//                     return {
//                         ...safeData,
//                         createdBy: userId,
//                         createdAt: new Date(),
//                         updatedAt: new Date(),
//                     };
//                 }

//             });

//             if (sanitizedData.length > 0) {

//                 await model.insertMany(sanitizedData, { session });
//             }
//         }

//         await session.commitTransaction();
//         session.endSession();

//         res.json({ message: 'Backup restored successfully!' });

//     } catch (err) {
//         await session.abortTransaction();
//         session.endSession();

//         console.error('Restore failed:', err);
//         res.status(500).json({ message: 'Restore failed', error: err.message });
//     }
// };


// exports.generateBackup = async (req, res) => {
//     try {
//         const userId = req.user;
//         console.log(userId, "User ID for backup");

//         const backupDir = `/tmp/user_backup_${userId}`;
//         const backupFile = `${backupDir}.tar.gz`;

//         // Collections to back up
//         const collections = ["users", "purchases", "invoices", "transactions"];

//         // Build mongodump commands for each collection
//         const dumpCmds = collections.map((col) => {
//             const filterField = col === "users" ? "_id" : "createdBy"; // Users use _id, others use createdBy

//             let query = `\\"${filterField}\\": { \\"$eq\\" : { \\"$oid\\": \\"${userId}\\" } }`;

//             return `mongodump --uri="${process.env.Mongo_URI}" \
//             --collection=${col} --query="{${query}}" --out=${backupDir}/`;
//         });



//         console.log(dumpCmds,'Dump CMDs')
//         // Run all dump commands & compress
//         const finalCmd = `${dumpCmds.join(" && ")} && tar -czvf ${backupFile} ${backupDir}`;


//         exec(finalCmd, (err) => {
//             if (err) {
//                 console.error("Backup Error:", err);
//                 return res.status(500).send("Backup failed");
//             }
//             res.download(backupFile);
//         });
//     } catch (err) {
//         console.error("Unexpected Error:", err);
//         return res.status(500).send("Backup failed");
//     }
// };

//Implementing Backup and restore logic using mongodump and mongorestore for better result and speed
exports.generateBackup = async (req, res) => {
    try {
        const userId = req.user;

        console.log(userId, "User ID for backup");

        const backupDir = `/tmp/thijar_backup_${userId}`;
        const backupFile = `${backupDir}.tar.gz`;

        // Ensure backup directory exists
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        //Fetch all collection names dynamically
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);

        //  Function to dump a collection (returning a Promise)
        const dumpCollection = async (col) => {
            return new Promise(async (resolve, reject) => {
                let filterField = col === "users" ? "_id" : "createdBy";

                let query = `{"${filterField}": { "$oid": "${userId}" }}`;


                let queryTest = { [filterField]: new mongoose.Types.ObjectId(userId) };

                if (["states", "businessCategories", "countries"].includes(col)) {
                    // Empty query
                    query = "{}";
                };

                const count = await mongoose.connection.db.collection(col).countDocuments(queryTest);
                console.log(`Exporting ${count} documents from ${col}`);

                let dumpCmd;
                if (os.platform() === "win32") {
                    // Windows

                    dumpCmd = `mongodump --uri="${process.env.Mongo_URI}" --collection=${col} --query="{\\"${filterField}\\": {\\"$oid\\": \\"${userId}\\"}}" --out=${backupDir}`;

                } else {
                    // Linux/macOS
                    dumpCmd = `mongodump --uri="${process.env.Mongo_URI}" --collection=${col} --query='${query}' --out=${backupDir}`;
                };

                console.log(dumpCmd, 'Dmp CMd');
                exec(dumpCmd, (err) => {
                    if (err) {
                        console.error(`Backup failed for collection: ${col}`, err);
                        return reject(err);
                    }
                    resolve();
                });

            });
        };

        //  Running backups for all collections in parallel
        await Promise.all(collectionNames.map(col => dumpCollection(col)));

        // Compress the backup after all dumps
        const compressCmd = `tar -czvf ${backupFile} -C ${path.dirname(backupDir)} ${path.basename(backupDir)}`;
        console.log(compressCmd, 'Compress cmd');
        exec(compressCmd, (err) => {
            if (err) {
                console.error("Compression Error:", err);
                return res.status(500).send("Backup compression failed");
            };

            console.log("Backup completed successfully.");

            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="backup_${userId}.tar.gz"`);
            res.setHeader('Content-Transfer-Encoding', 'binary');
            return res.download(backupFile);
        });

    } catch (err) {
        console.error("Unexpected Error generate backup:", err);
        res.status(500).json({ message: "Backup Failed", error: err.message || err });
    }
};

async function deleteUserData(userId) {
    try {

        let collections = await mongoose.connection.listCollections();
        collections = collections.map(coll => coll.name);

        for (const col of collections) {

            if (col == "invoices") {
                let check = await mongoose.connection.collection(col).find({ createdBy: new mongoose.Types.ObjectId(userId) }).toArray();
                console.log(check, 'CJeck')

            }

            const result = await mongoose.connection.collection(col).deleteMany({ createdBy: new mongoose.Types.ObjectId(userId) });
            console.log(`Deleted ${result.deletedCount} documents from ${col}`);
            if (!result) return false;
        }

        // Deleting the user from users collection using _id
        const userResult = await mongoose.connection.collection("users").deleteOne({ _id: new mongoose.Types.ObjectId(userId) });
        console.log(`Deleted ${userResult.deletedCount} document(s) from users`);

        return true;
    } catch (err) {
        console.error("Error deleting user data:", err);
        return false;
    }
}

exports.restoreBackup = async (req, res) => {
    console.log("Restore Backup called");
    try {
        if (!req.file) {
            return res.status(400).send("No backup file uploaded");
        }

        // const userId = '67e236ad2bc79a8bf706ec46';
        const userId = req.user;

        const uploadedFile = req.file.path;
        const extractDir = `/tmp/thijar_backup_${userId}/${process.env.databaseName}`;

        console.log(process.env.databaseName, 'process.env.databaseName');

        if (!fs.existsSync(extractDir)) {
            fs.mkdirSync(extractDir, { recursive: true });
        };

        // Extracting uploaded backup
        const extractCmd = `tar -xzvf ${uploadedFile} -C ${extractDir}`;
        exec(extractCmd, async (err) => {
            if (err) {
                console.error("Extraction Error:", err);
                return res.status(500).send("Backup extraction failed");
            }

            console.log("Backup extracted successfully.");

            // Ensuring deletion is successful before proceeding
            const isDeleted = await deleteUserData(userId);
            if (!isDeleted) {
                return res.status(500).send("User data deletion failed, restore aborted.");
            };

            console.log("User data deleted, proceeding with restore...");
            // Restore data
            const restoreCmd = `mongorestore --uri="${process.env.Mongo_URI}"  --nsInclude="${process.env.databaseName}.*" --dir=${extractDir}`;
            exec(restoreCmd, (err, stdout, stderr) => {
                if (err) {
                    console.error("Restore Error:", err, stderr);
                    return res.status(500).send("Backup restore failed");
                }

                console.log(stderr, 'stderr test');
                console.log("Restore Output:", stdout);
                res.send("Backup restored successfully");
            });
        });
    } catch (err) {
        console.error("Unexpected Error:", err);

        res.status(500).json({ message: "Backup restore Failed", error: err.message || err });
    };
};