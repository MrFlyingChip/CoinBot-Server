const parseXlsx = require('excel');
const https = require('https');
var request = require('sync-request');

var options = {
    "method": "GET",
    "hostname": "rest.coinapi.io",
    "path": "/v1/exchangerate/",
    "headers": {'X-CoinAPI-Key': '76C22A1B-32F2-45CD-A2B5-AEA08A067075'}
};

var parseDate = function (date) {
    let splitDate = date.split('.');
    let data = new Date(splitDate[2], splitDate[1] - 1, splitDate[0], 0, 0, 0);
    data.setHours(data.getHours() + 2);
    return data.toISOString();
};

function createPart(parseExcelData, dealCounter, dataExcelCounter, partBudget, foundStrategy, db, parts) {
    db.collection('users').find().toArray((err, docs) => {
        if (err) console.log({'error': err});
        else {
            for(let i = 0; i < docs.length; i++){
                //bot.sendMessage(docs[i].user, "Симуляция началась!", {caption: "I'm a bot!"});
                var res = request('GET', 'https://api.telegram.org/bot571455368:AAF65ScR2kTNEvt9rLqRSrH5N3roZaR6sC8/sendMessage?chat_id=' + docs[i].user + '&text=Симуляция_началась!');
            }

        }
    });
    while (dealCounter < foundStrategy.partsNumber && dataExcelCounter < parseExcelData.length) {
        let coin = parseExcelData[dataExcelCounter][1];
        let recommendedValue = parseExcelData[dataExcelCounter][2];
        let date = parseDate(parseExcelData[dataExcelCounter][0]);
        try {
            var res = request('GET', 'https://rest.coinapi.io/v1/exchangerate/' + coin + '/BTC?time=' + date, {
                headers: {
                    'X-CoinAPI-Key': '76C22A1B-32F2-45CD-A2B5-AEA08A067075',
                },
            });
            let result = JSON.parse(res.getBody());
            let rate = result.rate;
            let percentValue = rate * 100 / recommendedValue;
            if (Math.abs(percentValue - 100) < foundStrategy.percentDeviation) {
                const deal = {
                    strategy: foundStrategy.name,
                    coin: coin,
                    date: date,
                    inputPrice: rate,
                    budget: partBudget,
                    currentPrice: rate,
                    maxPrice: rate,
                    currentIncome: 0,
                    incomeBTC: 0,
                    incomeDollars: 0,
                    days: 0,
                    closedParts: [],
                    status: null
                };
                parts.push(deal);
                dealCounter++;
                dataExcelCounter++;
            } else {
                dataExcelCounter++;
            }
        } catch (e) {
            console.log(e);
            dataExcelCounter++;
        }
    }
    simulateCoin(parseExcelData, dataExcelCounter, partBudget, parts, db, foundStrategy);

}

function simulateCoin(parseExcelData, dataExcelCounter, partBudget, parts, db, foundStrategy) {
    let incomeBTC = 0;
    let allParts = [];
    for (let dealCounter = 0; dealCounter < parts.length; dealCounter++) {
        let dateCounter = 0;
        let date = new Date(parts[dealCounter].date);
        date.setHours(new Date(parts[dealCounter].date).getHours() + dateCounter);
        while (parts[dealCounter].status !== 'Завершена' && date < new Date()) {
            date = date.toISOString();
            parts[dealCounter].days = (dateCounter % 24 === 0) ? parts[dealCounter].days + 1 : parts[dealCounter].days;
            try {
                var res = request('GET', 'https://rest.coinapi.io/v1/exchangerate/' + parts[dealCounter].coin + '/BTC?time=' + date, {
                    headers: {
                        'X-CoinAPI-Key': '76C22A1B-32F2-45CD-A2B5-AEA08A067075',
                    },
                });
                let result = JSON.parse(res.getBody());

                let rate = result.rate;
                let currentPrice = rate;
                if (parts[dealCounter].maxPrice < currentPrice) {
                    parts[dealCounter].maxPrice = currentPrice;
                }
                parts[dealCounter].currentPrice = currentPrice;
                let coin = partBudget / parts[dealCounter].inputPrice;
                try {
                    res = request('GET', 'https://rest.coinapi.io/v1/exchangerate/BTC/' + parts[dealCounter].coin + '?time=' + date, {
                        headers: {
                            'X-CoinAPI-Key': '76C22A1B-32F2-45CD-A2B5-AEA08A067075',
                        },
                    });
                    result = JSON.parse(res.getBody());
                    rate = result.rate;
                    parts[dealCounter].incomeBTC = coin / rate - partBudget;
                    let income = parts[dealCounter].incomeBTC * 100 / partBudget;
                    parts[dealCounter].currentIncome = income;
                    try {
                        res = request('GET', 'https://rest.coinapi.io/v1/exchangerate/BTC/USD?time=' + date, {
                            headers: {
                                'X-CoinAPI-Key': '76C22A1B-32F2-45CD-A2B5-AEA08A067075',
                            },
                        });
                        result = JSON.parse(res.getBody());

                        rate = result.rate;
                        parts[dealCounter].incomeDollars = parts[dealCounter].incomeBTC * rate;
                        let percent = parts[dealCounter].currentIncome;
                        if (parts[dealCounter].days <= foundStrategy.limitDays) {
                            if (percent >= foundStrategy.percentProfit) {
                                parts[dealCounter].status = 'Завершена';
                                incomeBTC += parts[dealCounter].incomeBTC;
                                while ((incomeBTC - partBudget) > 0) {
                                    if (dataExcelCounter < parseExcelData.length) {
                                        let coin = parseExcelData[dataExcelCounter][1];
                                        let recommendedValue = parseExcelData[dataExcelCounter][2];
                                        let date = parseDate(parseExcelData[dataExcelCounter][0]);
                                        try {
                                            var res = request('GET', 'https://rest.coinapi.io/v1/exchangerate/' + coin + '/BTC?time=' + date, {
                                                headers: {
                                                    'X-CoinAPI-Key': '76C22A1B-32F2-45CD-A2B5-AEA08A067075',
                                                },
                                            });
                                            let result = JSON.parse(res.getBody());
                                            let rate = result.rate;
                                            let percentValue = rate * 100 / recommendedValue;
                                            if (Math.abs(percentValue - 100) < foundStrategy.percentDeviation) {
                                                const deal = {
                                                    strategy: foundStrategy.name,
                                                    coin: coin,
                                                    date: date,
                                                    inputPrice: rate,
                                                    budget: partBudget,
                                                    currentPrice: rate,
                                                    maxPrice: rate,
                                                    currentIncome: 0,
                                                    incomeBTC: 0,
                                                    incomeDollars: 0,
                                                    days: 0,
                                                    status: null
                                                };
                                                parts.push(deal);
                                                dataExcelCounter++;
                                            } else {
                                                dataExcelCounter++;
                                            }
                                        } catch (e) {
                                            console.log(e);
                                            dataExcelCounter++;
                                        }
                                    } else {
                                        break;
                                    }
                                    incomeBTC -= partBudget;
                                }
                            } else if (percent < 0 && Math.abs(percent) >= foundStrategy.percentMinus) {
                                parts[dealCounter].status = 'Завершена';
                            }
                        } else {
                            if (foundStrategy.closeParts) {
                                for (let i = 0; i < foundStrategy.parts.length; i++) {
                                    if (percent >= foundStrategy.parts[i]) {
                                        if (!parts[dealCounter].closedParts.includes(i)) {
                                            parts[dealCounter].closedParts.push(i);
                                            incomeBTC += (parts[dealCounter].incomeBTC / foundStrategy.parts.length);
                                        }
                                    }
                                }
                                let closed = parts[dealCounter].closedParts.length;
                                parts[dealCounter].status = (closed === foundStrategy.parts.length) ? 'Завершена' : closed + '/' + foundStrategy.parts.length;
                            } else {
                                if (Math.abs(percent) >= foundStrategy.percentClose) {
                                    parts[dealCounter].status = 'Завершена';
                                    if (percent > 0) {
                                        incomeBTC += parts[dealCounter].incomeBTC;
                                    }
                                }
                            }
                        }
                        const deal = {
                            strategy: parts[dealCounter].strategy,
                            coin: parts[dealCounter].coin,
                            date: parts[dealCounter].date,
                            inputPrice: parts[dealCounter].inputPrice,
                            budget: parts[dealCounter].budget,
                            currentPrice: parts[dealCounter].currentPrice,
                            maxPrice: parts[dealCounter].maxPrice,
                            currentIncome: parts[dealCounter].currentIncome,
                            incomeBTC: parts[dealCounter].incomeBTC,
                            incomeDollars: parts[dealCounter].incomeDollars,
                            days: parts[dealCounter].days,
                            closedParts: parts[dealCounter].closedParts,
                            status: parts[dealCounter].status,
                            currentDate: date
                        };
                        allParts.push(deal);
                    } catch (e) {
                        console.log(e.message);
                    }
                } catch (e) {
                    console.log(e.message);
                }
            } catch (e) {
                console.log(e.message);
            }
            dateCounter += 6;
            date = new Date(parts[dealCounter].date);
            date.setHours(new Date(parts[dealCounter].date).getHours() + dateCounter);
        }
        let newPartCreated = false;
        if(parts[dealCounter].status === 'Завершена'){
            while (!newPartCreated) {
                if (dataExcelCounter < parseExcelData.length) {
                    let coin = parseExcelData[dataExcelCounter][1];
                    let recommendedValue = parseExcelData[dataExcelCounter][2];
                    let date = parseDate(parseExcelData[dataExcelCounter][0]);
                    try {
                        var res = request('GET', 'https://rest.coinapi.io/v1/exchangerate/' + coin + '/BTC?time=' + date, {
                            headers: {
                                'X-CoinAPI-Key': '76C22A1B-32F2-45CD-A2B5-AEA08A067075',
                            },
                        });
                        let result = JSON.parse(res.getBody());
                        let rate = result.rate;
                        let percentValue = rate * 100 / recommendedValue;
                        if (Math.abs(percentValue - 100) < foundStrategy.percentDeviation) {
                            const deal = {
                                strategy: foundStrategy.name,
                                coin: coin,
                                date: date,
                                inputPrice: rate,
                                budget: partBudget,
                                currentPrice: rate,
                                maxPrice: rate,
                                currentIncome: 0,
                                incomeBTC: 0,
                                incomeDollars: 0,
                                days: 0,
                                status: null
                            };
                            parts.push(deal);
                            dataExcelCounter++;
                            newPartCreated = true;
                        } else {
                            dataExcelCounter++;
                        }
                    } catch (e) {
                        console.log(e);
                        dataExcelCounter++;
                    }
                } else {
                    break;
                }
            }
        }

    }
    if (parts.length > 0) {
        db.collection('parts').insertMany(parts, (err, result) => {
            if (err) {
                //console.log(err)
            } else {
                console.log('Части загружены!');
            }
        });
        db.collection('allParts').insertMany(allParts, (err, result) => {
            if (err) {
                //console.log(err)
            } else {
                console.log('Части загружены!');
            }
        });
        db.collection('users').find().toArray((err, docs) => {
            if (err) console.log({'error': err});
            else {
                for(let i = 0; i < docs.length; i++){
                    //bot.sendMessage(docs[i].user, "Симуляция закончена!", {caption: "I'm a bot!"});
                    var res = request('GET', 'https://api.telegram.org/bot571455368:AAF65ScR2kTNEvt9rLqRSrH5N3roZaR6sC8/sendMessage?chat_id=' + docs[i].user + '&text=Симуляция_закончена!');
                }

            }
        });
    }
}

module.exports =  function (db, newDeal) {
    const strategy = {'name': newDeal.strategy};
    console.log(strategy);
    db.collection('strategies').findOne(strategy)
        .then(foundStrategy => {
                console.log(foundStrategy);
                parseXlsx('uploads/' + foundStrategy.coin, (errorExcel, parseExcelData) => {
                    if (errorExcel) {
                        console.log(errorExcel.name + ': ' + errorExcel.message);
                    } else {
                        let deals = [];
                        let dealCounter = 0;
                        let dataExcelCounter = 1;
                        let partBudget = newDeal.budget / foundStrategy.partsNumber;
                        createPart(parseExcelData, dealCounter, dataExcelCounter, partBudget, foundStrategy, db, deals);
                        //console.log(deals);
                    }
                });
            },
            errorDB => {
                console.log(errorDB.name + ': ' + errorDB.message);
            });
};

