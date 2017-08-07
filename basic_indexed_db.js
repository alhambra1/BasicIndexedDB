/**
* Written by Gilad Barkan, August, 2017
* Covered by the "Do whatever the heck you want with it" licence, 
* the full text of which is: Do whatever the heck you want with it. 
* [Attributed to http://stackoverflow.com/users/14860/paxdiablo]
*
* db: null,
* openDb: null,
* closeDb: null,
* deleteDb: null,
* clearObjectStore: null,
* getObjectStore: null,
* addRecord: null,
* getRecord: null,
* getRecordBy: null,
* getAllRecords: null,
* deleteRecord: null,
* deleteRecordBy: null
**/

var basicIndexedDB = (params={}) => (function (params) {
  const DB_NAME = params.dbName || 'basic_indexed_db';
  const DB_VERSION = params.dbVersion || 1;
  const OBJECT_STORE_NAME = params.schema && params.schema.objectStoreName ? params.schema.objectStoreName : 'basic_indexed_db_store';
  const SCHEMA = params.schema || {
    objectStoreName: 'basic_indexed_db_store',
    createObjectStoreOptions: {keyPath: 'id', autoIncrement: true}
  };

  const debug = params.debug || false; // applies log and error functions
  const methods = {};

  var db;

  function log(){
    if (debug)
      console.log.apply(console, arguments);
  }
  
  function error(){
    if (debug)
      console.error.apply(console, arguments);
  }
  
  /**
   * @param {Object} params
   * @param {string} params.dbName
   * @param {integer} params.dbVersion
   * @param {Schema} params.schema
   */
  function openDb(params) {
    log("openDb ...");

    params = params || {};
    params.dbName = params.dbName || DB_NAME;
    params.dbVersion = params.dbVersion || DB_VERSION;
    params.schema = params.schema || SCHEMA;

    return new Promise((resolve, reject) => {
      var req = indexedDB.open(params.dbName, params.dbVersion);
      req.onsuccess = function (evt) {
        // Better use "this" than "req" to get the result to avoid problems with
        // garbage collection.
        // db = req.result;
        db = this.result;
        log('Database, ' + params.dbName + ', opened successfully; openDb DONE.');
        resolve(db);
      };

      req.onerror = function (evt) {
        reject(evt);
      };

      req.onupgradeneeded = function (evt) {
        log("openDb.onupgradeneeded");
        var store = evt.currentTarget.result.createObjectStore(
          params.schema.objectStoreName,
          params.schema.createObjectStoreOptions
        );

        if (params.schema.indexes){
          for (let i=0; i<params.schema.indexes.length; i++){
            log("Creating index:", params.schema.indexes[i]);
            store.createIndex.apply(store, params.schema.indexes[i]);
          }
        }
      };
    });
  }
  methods.openDb = openDb;


  /**
   * @param {string} params.dbName
   */
  function closeDb(database) {
    log("closeDb ...");

    database = database || db;

    try {
      database.close();
      return true;

    } catch(error){
      error("closeDb:", evt.target.errorCode);
    }
  }
  methods.closeDb = closeDb;


  /**
   * @param {string} params.dbName
   */
  function deleteDb(dbName) {
    log("deleteDb:", arguments);

    dbName = dbName || DB_NAME;

    return new Promise((resolve, reject) => {
      var req = window.indexedDB.deleteDatabase(dbName);

      req.onsuccess = function(evt){
        log('Successfully deleted database, ' + dbName + '.')
        resolve(true);
      }

      req.onerror = function(evt){
        error("deleteDb:", evt.target.errorCode);
        reject(evt);
      }
    });
  }
  methods.deleteDb = deleteDb;


  /**
   * @param {string} storeName
   * @param {string} mode either "readonly" or "readwrite"
   * @param {IDBDatabase} database
   */
  function getObjectStore(storeName, mode, database) {
    database = database || db;

    var tx = database.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }
  methods.getObjectStore = getObjectStore;


  /**
   * @param {string} storeName
   * @param {IDBDatabase} database
   */
  function clearObjectStore(storeName, database) {
    log('clearObjectStore:', arguments);

    storeName = storeName || OBJECT_STORE_NAME;
    database = database || db;

    return new Promise((resolve, reject) => {
      var store = getObjectStore(storeName, 'readwrite', database);
      var req = store.clear();
      req.onsuccess = function(evt) {
        log('Store, ' + storeName + ', cleared');
        resolve(true);
      };
      req.onerror = function (evt) {
        error('clearObjectStore:', evt.target.errorCode);
        reject(evt);
      };
    });
  }
  methods.clearObjectStore = clearObjectStore;


  /**
  * @param {Key} key
  * @param {IDBObjectStore} store
  */
  function getRecord(key, store){
    log("getRecord:", arguments);

    return new Promise((resolve, reject) => {
      store = store || getObjectStore(OBJECT_STORE_NAME, 'readwrite');

      var req = store.get(key);

      req.onsuccess = function(evt) {
        var record = evt.target.result;

        log("record:", record);

        if (typeof record == 'undefined') {
          log("No matching record found");
          resolve(null);

        } else {
          resolve(record);
        }
      };

      req.onerror = function (evt) {
        error("getRecord:", evt.target.errorCode);
        reject(evt);
      };
    });
  }
  methods.getRecord = getRecord;


  /**
   * @param {Object} record
   * @param {string} storeName
   * @param {IDBDatabase} database
   */
  function addRecord(record, storeName, database) {
    log('addRecord arguments:', arguments);

    storeName = storeName || OBJECT_STORE_NAME;

    return new Promise((resolve, reject) => {
      var store = getObjectStore(storeName, 'readwrite', database);
      var req;
      try {
        req = store.add(record);
      } catch (e) {
        if (e.name == 'DataCloneError')
          error('This engine doesn\'t know how to clone a Blob, use Firefox');
        throw e;
      }
      req.onsuccess = function (evt) {
        log('Insertion in DB successful',evt);
        resolve(record);
      };
      req.onerror = function() {
        error('addRecord error', this.error);
        reject(this.error);
      };
    });
  }
  methods.addRecord = addRecord;


  /**
   * @param {string} indexName
   * @param {Key} key
   * @param {string} storeName
   * @param {IDBDatabase} database
   */
  function deleteRecordBy(indexName, key, storeName, database) {
    log("deleteRecord:", arguments);

    storeName = storeName || OBJECT_STORE_NAME;

    return new Promise((resolve, reject) => {
      var store = getObjectStore(storeName, 'readwrite', database);
      var req = store.index(indexName);
      req.get(key).onsuccess = function(evt) {
        if (typeof evt.target.result == 'undefined') {
          log("No matching record found");
          resolve(false);
        } else {
          deleteRecord(evt.target.result.id, store)
            .then(deleteResult => resolve(deleteResult))
            .catch(error => reject(error));
        }
      };
      req.onerror = function (evt) {
        error("deleteRecordBy:", evt.target.errorCode);
        reject(evt);
      };
    });
  }
  methods.deleteRecordBy = deleteRecordBy;


  /**
   * Deletes record by primary key
   * @param {number} key
   * @param {IDBObjectStore=} store
   */
  function deleteRecord(key, store) {
    log("deleteRecord:", arguments);

    return new Promise((resolve, reject) => {
      store = store || getObjectStore(OBJECT_STORE_NAME, 'readwrite');

      // As per spec http://www.w3.org/TR/IndexedDB/#object-store-deletion-operation
      // the result of the Object Store Deletion Operation algorithm is
      // undefined, so it's not possible to know if some records were actually
      // deleted by looking at the request result.
      var req = store.get(key);

      req.onsuccess = function(evt) {
        var record = evt.target.result;

        log("record:", record);

        if (typeof record == 'undefined') {
          log("No matching record found");
          resolve(null);

        } else {
          // Warning: The exact same key used for creation needs to be passed for
          // the deletion. If the key was a Number for creation, then it needs to
          // be a Number for deletion.
          req = store.delete(key);
          req.onsuccess = function(evt) {
            log("evt:", evt);
            log("evt.target:", evt.target);
            log("evt.target.result:", evt.target.result);
            log("delete successful");
            resolve(true);
          };
          req.onerror = function (evt) {
            error("deleteRecord:", evt.target.errorCode);
            reject(evt);
          };
        }
      };

      req.onerror = function (evt) {
        error("deleteRecord:", evt.target.errorCode);
        reject(evt);
      };
    });
  }
  methods.deleteRecord = deleteRecord;


  /**
   * @param {string} indexName
   * @param {Key} key
   * @param {string} storeName
   * @param {IDBDatabase} database
   */
  function getRecordBy(indexName, key, storeName, database) {
    log("getRecordBy:", arguments);

    storeName = storeName || OBJECT_STORE_NAME

    return new Promise((resolve, reject) => {
      var store = getObjectStore(storeName, 'readwrite', database),
          req = store.index(indexName);

      req.get(key).onsuccess = function(evt) {
        if (typeof evt.target.result == 'undefined') {
          log("getRecordBy: No matching record found");
          resolve(null);
        } else {
          resolve(evt.target.result);
        }
      };
      req.onerror = function (evt) {
        reject(evt);
      };
    });
  }
  methods.getRecordBy = getRecordBy;


  /**
   * @param {string} storeName
   * @param {IDBDatabase} database
   */
  function getAllRecords(storeName, database) {
    log("getAllRecords");

    storeName = storeName || OBJECT_STORE_NAME;

    return new Promise((resolve, reject) => {
      var store = getObjectStore(storeName, 'readonly', database),
          req,
          results = [];

      req = store.openCursor();
      req.onsuccess = function(evt) {
        var cursor = evt.target.result;

        // If the cursor is pointing at something, ask for the data
        if (cursor) {
          log("getAllRecords cursor:", cursor);
          req = store.get(cursor.key);
          req.onsuccess = function (evt) {
            results.push(evt.target.result);
          };

          // Move on to the next object in store
          cursor.continue();
        } else {
          log("No more entries");
          resolve(results);
        }
      };
    });
  }
  methods.getAllRecords = getAllRecords;

  return methods;
})(params);
