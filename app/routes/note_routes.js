module.exports = function (app, db, upload) {
    app.post('/strategy', (req, res) => {
        let result = req.body;
        const strategy = {
            coin: result.coin,
            name: result.name,
            partsNumber: result.partsNumber,
            percentProfit: result.percentProfit,
            percentDeviation: result.percentDeviation,
            percentMinus: result.percentMinus,
            limitDays: result.limitDays,
            percentClose: result.percentClose,
            closeParts: result.closeParts,
            parts: result.parts
        };
        const strategyCheck = {name: req.body.name};
        db.collection('strategies').findOne(strategyCheck, (err, item) => {
            if (item) {
                res.send({'message': "Такая стратегия уже есть!"});
            } else {
                db.collection('strategies').insert(strategy, (err, result) => {
                    if (err) {
                        res.send({'message': err});
                    } else {
                        res.send({'message': 'Стратегия загружена!'});
                    }
                });
            }
        });
    });

    app.post('/deal', (req, res) => {
        const deal = {
            strategy: req.body.strategy,
            budget: req.body.budget,
            parts: []
        };
        db.collection('deals').insert(deal, (err, result) => {
            if (err) {
                res.send({'message': err});
            } else {
                require('../bot')(db, result.ops[0]);
                res.send({'message': 'Сделка загружена!'});
            }
        });
    });

    app.post('/part', (req, res) => {
        const deal = {
            strategy: req.body.strategy,
            coin: req.body.coin,
            date: req.body.date,
            inputPrice: 0,
            budget: req.body.budget,
            currentPrice: 0,
            maxPrice: 0,
            currentIncome: 0,
            incomeBTC: 0,
            incomeDollars: 0,
            days: 0,
            status: null
        };
        db.collection('parts').insert(deal, (err, result) => {
            if (err) {
                res.send({'message': err});
            } else {
                res.send({'message': 'Сделка загружена!'});
            }
        });
    });

    app.post('/coins', upload.single('coin'), (req, res, next) => {
        const coin = {coin: req.file.originalname};
        const coinInsert = {coin: req.file.originalname, date: new Date().toDateString()};
        db.collection('coins').findOne(coin, (err, item) => {
            if (item) {
                res.send({'message': "Такая база уже есть!"});
            } else {
                db.collection('coins').insert(coinInsert, (err, result) => {
                    if (err) {
                        res.send({'message': err});
                    } else {
                        res.send({'message': 'Файл загружен!'});
                    }
                });
            }
        });
    });

    app.get('/coins', (req, res) => {
        db.collection('coins').find().toArray((err, docs) => {
            if (err) res.send({'error': err});
            else res.send(docs);
        });
    });

    app.get('/parts', (req, res) => {
        db.collection('parts').find().toArray((err, docs) => {
            if (err) res.send({'error': err});
            else res.send(docs);
        });
    });

    app.get('/coin', (req, res) => {

    });

    app.delete('/strategy/:id', (req, res) => {
        const id = req.params.id.toString();
        var ObjectID = require('mongodb').ObjectID;
        const details = {'_id': new ObjectID(id)};
        db.collection('strategies').remove(details, (err, item) => {
            if (err) {
                res.send({'error': 'An error has occurred'});
            } else {
                res.send({'message': 'Strategy ' + id + ' deleted!'});
            }
        });
    });

    app.get('/strategies', (req, res) => {
        db.collection('strategies').find().toArray((err, strategies) => {
            if (err) res.send({'error': err});
            else res.send(strategies)
        });
    });

    app.get('/strategies_info', (req, res) => {
        db.collection('strategies').find().toArray((err, strategies) => {
            if (err) res.send({'error': err});
            else {
                db.collection('parts').find().toArray((err, parts) => {
                    if (err) res.send({'error': err});
                    else {
                        let result = [];
                        for (let i = 0; i < strategies.length; i++) {
                            let profit = 0;
                            let price = 0;
                            let date = new Date(parts[0].date);
                            date.setDate(new Date(parts[0].date).getDay() + parts[0].days);
                            let strategy = {
                                id: strategies[i]._id,
                                name: strategies[i].name,
                                coin: strategies[i].coin,
                                startDate: new Date(parts[0].date),
                                finishDate: date,
                                profitParts: 0,
                                minusParts: 0,
                                waitParts: 0,
                                percentProfit: 0
                            };
                            for (let j = 0; j < parts.length; j++) {
                                if (strategy.name === parts[j].strategy) {
                                    price += parts[j].budget;
                                    profit += parts[j].incomeBTC;
                                    if (strategy.startDate > parts[j].date) {
                                        strategy.startDate = new Date(parts[j].date);
                                    }
                                    date = new Date(parts[j].date);
                                    date.setDate(new Date(parts[j].date).getDay() + parts[j].days);
                                    if (strategy.finishDate < date) {
                                        strategy.finishDate = date;
                                    }
                                    if (parts[j].status === 'Завершена') {
                                        if (parts[j].incomeBTC >= 0) {
                                            strategy.profitParts++;
                                        } else {
                                            strategy.minusParts++;
                                        }

                                    } else {
                                        strategy.waitParts++;
                                    }
                                }
                            }
                            let percent = profit * 100 / price;
                            strategy.percentProfit = percent.toFixed(2);
                            result.push(strategy);
                        }
                        res.send(result);
                    }
                });
            }
        });
    });

    app.get('/strategy/:id', (req, res) => {
        const id = req.params.id.toString();
        var ObjectID = require('mongodb').ObjectID;
        const details = {'_id': new ObjectID(id)};
        db.collection('strategies').findOne(details, (err, item) => {
            if (err) res.send({'error': err.message});
            res.send(item);
        });
    });

    app.put('/strategy/:id', (req, res) => {
        const id = req.params.id.toString();
        var ObjectID = require('mongodb').ObjectID;
        const details = {'_id': new ObjectID(id)};
        const strategy = {
            coin: req.body.coin,
            name: req.body.name,
            partsNumber: req.body.partsNumber,
            percentProfit: req.body.percentProfit,
            percentDeviation: req.body.percentDeviation,
            percentMinus: req.body.percentMinus,
            limitDays: req.body.limitDays,
            percentClose: req.body.percentClose,
            closeParts: req.body.closeParts,
            parts: req.body.parts
        };
        db.collection('strategies').update(details, strategy, (err, result) => {
            if (err) {
                res.send({'error': 'An error has occurred'});
            } else {
                res.send({'message': 'Стратегия изменена!'});
            }
        });
    });
};