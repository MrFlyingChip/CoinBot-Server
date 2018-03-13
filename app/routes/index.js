const noteRoutes = require('./note_routes');
module.exports = function (app, db, upload) {
    noteRoutes(app, db, upload);
};