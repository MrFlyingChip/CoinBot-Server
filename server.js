const express         = require('express');
const MongoClient     = require('mongodb').MongoClient;
const bodyParser      = require('body-parser');
const db              = require('./config/db');
const multer          = require('multer');
const cors = require('cors');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
})
const upload          = multer({storage: storage,
                                fileFilter: function (req, file, cb) {
                                    if (!file.originalname.match(/\.(xls|xlsx|csv)$/)) {
                                        return cb(new Error('Only Excel files are allowed!'));
                                    }
                                    cb(null, true);
                                }});
const app             = express();

const port = 8000;
app.use(bodyParser.json());
app.use(cors());
MongoClient.connect(db.url, (err, database) =>{
    if(err) return console.log(err);
    require('./app/routes')(app, database, upload);
    app.listen(port, () => {
        //require('./app/bot')(database);
        console.log('We are live on ' + port);
});
});

