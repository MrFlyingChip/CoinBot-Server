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
                setTimeout(function() {
                    require('../bot')(db, result.ops[0]);
                }, 5 * 1000);
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

    app.post('/571455368:AAF65ScR2kTNEvt9rLqRSrH5N3roZaR6sC8', (req, res) => {
        let userID = {user: req.body.message.chat.id};
                db.collection('users').insert(userID, (err, result) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log(result);
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

    app.delete('/coin/:id', (req, res) => {
        const id = req.params.id.toString();
        var ObjectID = require('mongodb').ObjectID;
        const details = {'_id': new ObjectID(id)};
        const fs = require('fs');
        db.collection('coins').findOne(details, (err, coin) => {
            db.collection('coins').remove(details, (err, item) => {
                if (err) {
                    res.send({'error': 'An error has occurred'});
                } else {
                    fs.unlink('uploads/' + coin.coin, (err) => {
                        if (err) throw err;
                        console.log('File was deleted');
                        res.send({'message': 'Coin ' + id + ' deleted!'});
                    });
                }
            });
        });
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

    app.post('/strategies_info', (req, res) => {
        console.log(req.body);
        db.collection('strategies').find().toArray((err, strategies) => {
            if (err) res.send({'error': err});
            else {
                db.collection('allParts').find().toArray((err, parts) => {
                    if (err) res.send({'error': err});
                    else {
                        let result = [];
                        for (let i = 0; i < strategies.length; i++) {
                            let profit = 0;
                            let price = 0;
                            let dateStart = (req.body.startDate[i]) ?  req.body.startDate[i] : new Date(2017, 1, 1);
                            let dateFinish = (req.body.finishDate[i]) ? req.body.finishDate[i]: new Date();

                            let strategy = {
                                id: strategies[i]._id,
                                name: strategies[i].name,
                                coin: strategies[i].coin,
                                profitParts: 0,
                                minusParts: 0,
                                waitParts: 0,
                                percentProfit: 0
                            };
                            for(let j = 0; j < parts.length; j++){
                                if(parts[j].strategy === strategy.name){
                                    if(new Date(parts[j].currentDate) >= new Date(dateStart) && new Date(parts[j].currentDate) <= new Date(dateFinish)){
                                        if(parts[j + 1] === undefined
                                            || parts[j + 1].coin !== parts[j].coin
                                            || (parts[j + 1].coin === parts[j].coin && new Date(parts[j+1].currentDate) > new Date(dateFinish))){
                                            profit += parts[j].incomeBTC;
                                            price += parts[j].budget;
                                            if(parts[j].status === 'Завершена'){
                                                if(parts[j].incomeBTC >= 0) strategy.profitParts++;
                                                else strategy.minusParts++;
                                            }
                                            else{
                                                strategy.waitParts++;
                                            }
                                        }
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

    app.post('/strategy_info/:id', (req, res) => {
        const id = req.params.id.toString();
        var ObjectID = require('mongodb').ObjectID;
        const details = {'_id': new ObjectID(id)};
        db.collection('strategies').findOne(details, (err, item) => {
            if (err) res.send({'error': err});
            else {
                db.collection('allParts').find().toArray((err, parts) => {
                    if (err) res.send({'error': err});
                    else {
                        let result = [];
                        let dateStart = req.body.startDate;
                        let dateFinish = req.body.finishDate;
                        for(let i = 0; i < parts.length; i++){
                            if(item.name === parts[i].strategy) {
                                if (new Date(parts[i].currentDate) >= new Date(dateStart) && new Date(parts[i].currentDate) <= new Date(dateFinish)) {
                                    if (parts[i + 1] === undefined
                                        || parts[i + 1].coin !== parts[i].coin
                                        || (parts[i + 1].coin === parts[i].coin && new Date(parts[i + 1].currentDate) > new Date(dateFinish))) {

                                            result.push(parts[i]);

                                    }
                                }
                            }
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
                else {
                    res.send(item);
                }
            });
        });

        app.post('/strategy/:id', (req, res) => {
            const id = req.params.id.toString();
            var ObjectID = require('mongodb').ObjectID;
            const details = {'_id': new ObjectID(id)};
            db.collection('strategies').findOne(details, (err, item) => {
                if (err) res.send({'error': err.message});

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