const parseXlsx = require('excel');
const https = require('https');
var request = require('sync-request');

var options = {
    "method": "GET",
    "hostname": "rest.coinapi.io",
    "path": "/v1/exchangerate/",
    "headers": {'X-CoinAPI-Key': '76C22A1B-32F2-45CD-A2B5-AEA08A067075'}
};
let incomeBTC = 0;
let dataExcelCounter = 1;

var parseDate = function (date) {
    let splitDate = date.split('.');
    return (new Date(splitDate[2], splitDate[1] - 1, splitDate[0], 0, 0, 0)).toISOString();
};

function makeRequest(url){
    return request('GET', url, {
        headers: {
            'X-CoinAPI-Key': '76C22A1B-32F2-45CD-A2B5-AEA08A067075',
        },
    });
}

function createNewDeal(name, coin, date, inputPrice, budget){
    return {
        strategy: name,
        coin: coin,
        date: date,
        inputPrice: inputPrice,
        budget: budget,
        currentPrice: inputPrice,
        maxPrice: inputPrice,
        currentIncome: 0,
        incomeBTC: 0,
        incomeDollars: 0,
        days: 0,
        closedParts: [],
        status: null
    };
}

function createPart(parseExcelData, dealCounter, partBudget, foundStrategy, db, parts) {
    while (dealCounter < foundStrategy.partsNumber && dataExcelCounter < parseExcelData.length) {
        let coin = parseExcelData[dataExcelCounter][1];
        let recommendedValue = parseExcelData[dataExcelCounter][2];
        let date = parseDate(parseExcelData[dataExcelCounter][0]);
        try {
            var res = makeRequest('https://rest.coinapi.io/v1/exchangerate/' + coin + '/BTC?time=' + date);
            let result = JSON.parse(res.getBody());
            let rate = result.rate;
            let percentValue = rate * 100 / recommendedValue;
            if (Math.abs(percentValue - 100) < foundStrategy.percentDeviation) {
                const deal = createNewDeal(foundStrategy.name, coin, date, rate, partBudget);
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
    simulateCoin(parseExcelData, partBudget, parts, db, foundStrategy);
}

function simulateCoin(parseExcelData, partBudget, parts, db, foundStrategy) {
    incomeBTC = 0;
    let allParts = [];
    for (let dealCounter = 0; dealCounter < parts.length; dealCounter++) {
        simulateDeal(parts, allParts, foundStrategy, dealCounter, parseExcelData, partBudget);
    }
    if (parts.length > 0) {
        insertArrayToDB(parts, 'parts');
        insertArrayToDB(allParts, 'allParts');
    }
}

function createPartOfDeal(deal, date){
    return {
        strategy: deal.strategy,
        coin: deal.coin,
        date: deal.date,
        inputPrice: deal.inputPrice,
        budget: deal.budget,
        currentPrice: deal.currentPrice,
        maxPrice: deal.maxPrice,
        currentIncome: deal.currentIncome,
        incomeBTC: deal.incomeBTC,
        incomeDollars: deal.incomeDollars,
        days: deal.days,
        closedParts: deal.closedParts,
        status: deal.status,
        currentDate: date
    };
}

function insertArrayToDB(array, db){
    db.collection(db).insertMany(array, (err, result) => {
        if (err) {
            //console.log(err)
        } else {
            console.log('Части загружены!');
        }
    });
}

function simulateDeal(parts, allParts, foundStrategy, dealCounter, parseExcelData, partBudget){
    let dateCounter = 0;
    let date = new Date(parts[dealCounter].date);
    date.setHours(new Date(parts[dealCounter].date).getHours() + dateCounter);
    while (parts[dealCounter].status !== 'Завершена' && date < new Date()) {
        date = date.toISOString();
        parts[dealCounter].days = (dateCounter % 24 === 0) ? parts[dealCounter].days + 1 : parts[dealCounter].days;
        simulatePart(parts, allParts, foundStrategy, dealCounter, incomeBTC, parseExcelData, date, partBudget);
        dateCounter += 6;
        date = new Date(parts[dealCounter].date);
        date.setHours(new Date(parts[dealCounter].date).getHours() + dateCounter);
    }
}

function simulatePart(parts, allParts, foundStrategy, dealCounter, parseExcelData, date, partBudget){
    try {
        var res = makeRequest('https://rest.coinapi.io/v1/exchangerate/' + parts[dealCounter].coin + '/BTC?time=' + date);
        let result = JSON.parse(res.getBody());
        let rate = result.rate;
        let currentPrice = rate;
        if (parts[dealCounter].maxPrice < currentPrice) {
            parts[dealCounter].maxPrice = currentPrice;
        }
        parts[dealCounter].currentPrice = currentPrice;
        let coin = partBudget / parts[dealCounter].inputPrice;
        try {
            res = makeRequest('https://rest.coinapi.io/v1/exchangerate/BTC/' + parts[dealCounter].coin + '?time=' + date);
            result = JSON.parse(res.getBody());
            rate = result.rate;
            parts[dealCounter].incomeBTC = coin / rate - partBudget;
            let income = parts[dealCounter].incomeBTC * 100 / partBudget;
            parts[dealCounter].currentIncome = income;
            try{
                res = makeRequest('https://rest.coinapi.io/v1/exchangerate/BTC/USD?time=' + date);
                result = JSON.parse(res.getBody());
                rate = result.rate;
                parts[dealCounter].incomeDollars = parts[dealCounter].incomeBTC * rate;
                let percent = parts[dealCounter].currentIncome;
                if (parts[dealCounter].days <= foundStrategy.limitDays) {
                    if (percent >= foundStrategy.percentProfit) {
                        parts[dealCounter].status = 'Завершена';
                        let createdDeal = false;
                        while(!createdDeal){
                            if (dataExcelCounter < parseExcelData.length) {
                                let coin = parseExcelData[dataExcelCounter][1];
                                let recommendedValue = parseExcelData[dataExcelCounter][2];
                                let date = parseDate(parseExcelData[dataExcelCounter][0]);
                                try {
                                    res = makeRequest('https://rest.coinapi.io/v1/exchangerate/' + coin + '/BTC?time=' + date);
                                    let result = JSON.parse(res.getBody());
                                    let rate = result.rate;
                                    let percentValue = rate * 100 / recommendedValue;
                                    if (Math.abs(percentValue - 100) < foundStrategy.percentDeviation) {
                                        const deal = createNewDeal(foundStrategy.name, coin, date, rate, partBudget);
                                        parts.push(deal);
                                        dataExcelCounter++;
                                        createdDeal = true;
                                    } else {
                                        dataExcelCounter++;
                                    }
                                } catch (e) {
                                    console.log(e);
                                    dataExcelCounter++;
                                }
                            } else {
                                createdDeal = true;
                            }
                        }
                        incomeBTC += parts[dealCounter].incomeBTC;
                        while ((incomeBTC - partBudget) > 0) {
                            if (dataExcelCounter < parseExcelData.length) {
                                let coin = parseExcelData[dataExcelCounter][1];
                                let recommendedValue = parseExcelData[dataExcelCounter][2];
                                let date = parseDate(parseExcelData[dataExcelCounter][0]);
                                try {
                                    var res = makeRequest('https://rest.coinapi.io/v1/exchangerate/' + coin + '/BTC?time=' + date);
                                    let result = JSON.parse(res.getBody());
                                    let rate = result.rate;
                                    let percentValue = rate * 100 / recommendedValue;
                                    if (Math.abs(percentValue - 100) < foundStrategy.percentDeviation) {
                                        const deal = createNewDeal(foundStrategy.name, coin, date, rate, partBudget);
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
                        let createdDeal = false;
                        while(!createdDeal){
                            if (dataExcelCounter < parseExcelData.length) {
                                let coin = parseExcelData[dataExcelCounter][1];
                                let recommendedValue = parseExcelData[dataExcelCounter][2];
                                let date = parseDate(parseExcelData[dataExcelCounter][0]);
                                try {
                                    res = makeRequest('https://rest.coinapi.io/v1/exchangerate/' + coin + '/BTC?time=' + date);
                                    let result = JSON.parse(res.getBody());
                                    let rate = result.rate;
                                    let percentValue = rate * 100 / recommendedValue;
                                    if (Math.abs(percentValue - 100) < foundStrategy.percentDeviation) {
                                        const deal = createNewDeal(foundStrategy.name, coin, date, rate, partBudget + parts[dealCounter].incomeBTC);
                                        parts.push(deal);
                                        dataExcelCounter++;
                                        createdDeal = true;
                                    } else {
                                        dataExcelCounter++;
                                    }
                                } catch (e) {
                                    console.log(e);
                                    dataExcelCounter++;
                                }
                            } else {
                                createdDeal = true;
                            }
                        }
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
                                let createdDeal = false;
                                while(!createdDeal){
                                    if (dataExcelCounter < parseExcelData.length) {
                                        let coin = parseExcelData[dataExcelCounter][1];
                                        let recommendedValue = parseExcelData[dataExcelCounter][2];
                                        let date = parseDate(parseExcelData[dataExcelCounter][0]);
                                        try {
                                            res = makeRequest('https://rest.coinapi.io/v1/exchangerate/' + coin + '/BTC?time=' + date);
                                            let result = JSON.parse(res.getBody());
                                            let rate = result.rate;
                                            let percentValue = rate * 100 / recommendedValue;
                                            if (Math.abs(percentValue - 100) < foundStrategy.percentDeviation) {
                                                const deal = createNewDeal(foundStrategy.name, coin, date, rate, partBudget);
                                                parts.push(deal);
                                                dataExcelCounter++;
                                                createdDeal = true;
                                            } else {
                                                dataExcelCounter++;
                                            }
                                        } catch (e) {
                                            console.log(e);
                                            dataExcelCounter++;
                                        }
                                    } else {
                                        createdDeal = true;
                                    }
                                }
                            }
                            else{
                                let createdDeal = false;
                                while(!createdDeal){
                                    if (dataExcelCounter < parseExcelData.length) {
                                        let coin = parseExcelData[dataExcelCounter][1];
                                        let recommendedValue = parseExcelData[dataExcelCounter][2];
                                        let date = parseDate(parseExcelData[dataExcelCounter][0]);
                                        try {
                                            res = makeRequest('https://rest.coinapi.io/v1/exchangerate/' + coin + '/BTC?time=' + date);
                                            let result = JSON.parse(res.getBody());
                                            let rate = result.rate;
                                            let percentValue = rate * 100 / recommendedValue;
                                            if (Math.abs(percentValue - 100) < foundStrategy.percentDeviation) {
                                                const deal = createNewDeal(foundStrategy.name, coin, date, rate, partBudget + parts[dealCounter].incomeBTC);
                                                parts.push(deal);
                                                dataExcelCounter++;
                                                createdDeal = true;
                                            } else {
                                                dataExcelCounter++;
                                            }
                                        } catch (e) {
                                            console.log(e);
                                            dataExcelCounter++;
                                        }
                                    } else {
                                        createdDeal = true;
                                    }
                                }
                            }
                        }
                    }
                }
                const deal = createPartOfDeal(parts[dealCounter], date);
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
                        dataExcelCounter = 1;
                        let partBudget = newDeal.budget / foundStrategy.partsNumber;
                        createPart(parseExcelData, dealCounter, partBudget, foundStrategy, db, deals);
                        //console.log(deals);
                    }
                });
            },
            errorDB => {
                console.log(errorDB.name + ': ' + errorDB.message);
            });
};

