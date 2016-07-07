module.exports = function(RED) {
    "use strict";
    var sqlite3 = require('sqlite3');
    var events = require('events');
    var eventEmitter = new events.EventEmitter();
   
    function SqliteQueryNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        
        node.on("input", function(msg) {
            var db = new sqlite3.Database(':memory:');
            
            db.on('open', function() {
                    node.log("opened ok");
                    if (typeof msg.topic === 'string') {
                    console.log("query:",msg.topic);
                    if(msg.payload !== null && typeof(msg.payload) === 'object'){
                        var jsonData = msg.payload;
                        //for each table
                        for(var table in jsonData){
                            console.log(table);
                            var tableData = jsonData[table];
                            if ((!(Array.isArray(tableData))) || tableData.length === 0){
                                console.log('Array of row expected for table:' + table);
                            }
                            else{                            
                                //create table
                                var createQuery = 'Create Table [' + table + '] (';
                                for(var column in tableData[0]){
                                    createQuery = createQuery + column + ' TEXT,'
                                }
                                createQuery = createQuery.substring(0,createQuery.length - 1) + ');';
                                console.log(createQuery);
                                db.all(createQuery,function (err) {
                                    if (err) { node.error(err,msg); }
                                    else{
                                        console.log('table created');
                                        var numRows = tableData.length;
                                        var rowCompleteCount = 0;
                                        eventEmitter.on('row-complete', function () {
                                            ++rowCompleteCount;
                                            console.log('row complete : ' + rowCompleteCount);
                                            if(rowCompleteCount===numRows){
                                                eventEmitter.emit('data-complete');
                                            }
                                        });
                                        //insert rows
                                        for(var i = 0; i< numRows; i++){
                                            var row = tableData[i];                                        
                                            var insertQuery = 'Insert Into [' + table + '] Values ('                                        
                                            for(var column in row){                                    
                                                insertQuery = insertQuery + '"' + row[column] + '",'
                                            }
                                            insertQuery = insertQuery.substring(0,insertQuery.length - 1) + ');';                            
                                            console.log(insertQuery);
                                            db.all(insertQuery,function (err) {
                                                if (err) { node.error(err,msg); }
                                                else{ eventEmitter.emit('row-complete'); }    
                                            });
                                        }
                                    } 
                                });              
                            }
                        }
                    }
                    
                    eventEmitter.on('data-complete',function () {
                        db.all(msg.topic, function(err, row) {
                            if (err) { node.error(err,msg); }
                            else {
                                msg.payload = row;
                                node.send(msg);
                            }
                            //db.close();
                            eventEmitter.removeAllListeners('row-complete');
                            eventEmitter.removeAllListeners('data-complete');
                        });
                    })
                    
                }
                else {
                    if (typeof msg.topic !== 'string') {
                        node.error("msg.topic : the query is not defined as a string",msg);
                    }
                }
            });
            db.on('error', function(err) {
                node.error("failed to open db", err);
            });
            db.on('close', function() {
                node.log("database closed");                
            });
        });
    }
    RED.nodes.registerType("sqlite-query",SqliteQueryNode);
}
