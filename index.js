const fs = require('fs');
const probables = require('./probables');

const getData = async() => {
    try {
   
        // Today's date, or provide your own: format 2019-03-24
        const d = new Date();
        const day = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
        console.log(day);
        
        // File to write to
        const outputFile = './probable-pitchers.json';

        // Get pitchers
        probables.mlbpitchers.getPitchers(day, (data) => {
            fs.writeFile(outputFile, JSON.stringify(data), {flag: 'w'}, (err) => {
                if (err) {
                    console.error(`Error in writing to ${file}: ${err}`);
                } else {
                    console.error(`Probable pitchers successfully written to ${outputFile}.`);
                }
            });
        });
    } catch (err) {
        console.error(`Error in getData(): ${err}`);
    }

};

getData();




        

