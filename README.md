# couch-provider

Provide methods to interface with couchdb and your server application.

Upload documents, attachments, retrieve, modify, delete, create database. 

**If you don't want to store attachments in the couchdb server you can provide a 'datapath' in the configuration. 
The attachments will be store in that location on your server.**

This package is implemented using [bluebird](https://github.com/petkaantonov/bluebird) Promises

Use this package to migrate documents, for example, you would like to add a new field/data to your
user documents in the DB. 

## Table of Contents

1. [Install](#install)
2. [Usage](#usage)
    1. [Standalone](#standalone)
    2. [Hapi plugin](#hapi-plugin)
4. [Documents migration](#documents-migration)

## Installation

Install couchdb by folling instructions [here](https://couchdb.apache.org/)

----
	npm install couch-provider
----

## Usage

### Standalone 

Codename is always optional, if not provided it will use the 'default' name in your configuration

----
	//Multiple db configuration, namespace is optional, you can add multiple namespaces by providing an array
	var couchdbconfig = {
		"default" : "db1",
		"db1" : {
			"hostname": "http://localhost:5984",
			"database": "users1",
			"datapath": "/some/path/in/server"
		},
		"db2" : {
			"hostname": "http://yourdomain.com",
			"database": "users2"
		}
	}

	//Single db configuration, namespace is optional
	//var couchdbconfig = {
	//	"hostname": "http://localhost:5984",
	//	"database": "users1"
	//}

	const {couchProvider} = require('couch-provider');
	couchProvider.setConfiguration(confexample);

	var url = couchProvider.getCouchDBServer(codename);

---

#### Create DB 
---

    return couchProvider.createDB("users1")
    .then(function(res){
        console.log(res);
    }); 

---

#### Upload a document
---
	
	var docs = [{
		"someinfo" : "someotherinfo"
	}];

	return couchProvider.uploadDocuments(docs, codename)
    .then(function(res){
        var docids = _.pluck(res, "id");//Underscore library https://underscorejs.org/
    });
---

#### Fetch documents
---

	return Promise.map(docids, function(docid){
        return couchProvider.getDocument(docid, codename);
    })
    .then(function(doc){
        console.log(doc);
    });
---
        
#### Add attachment
---
    var filename = path.join(__dirname, "README.md");
    var stream = fs.createReadStream(filename);

    return Promise.map(docids, function(docid){
        return couchProvider.getDocument(docid, codename)
        .then(function(doc){
            return couchProvider.addDocumentAttachment(doc, 'name/in/database.txt', stream, codename);
        });
    });
---
        
#### Get attachment
---

	return couchProvider.getDocument(docid, codename)
    .then(function(doc){
        return couchProvider.getDocumentAttachment(doc, 'name/in/database.txt', codename);
    })
    .then(function(res){
    	//res is a buffer with the file content
        console.log(res.toString());
    });

---

#### Get attachment stream
---

	return couchProvider.getDocument(docid, codename)
    .then(function(doc){
		var stream = couchProvider.getDocumentStreamAttachment(doc, 'name/in/database.txt', codename);        

		//Do something with the stream, write, pipe somewhere, etc. 
    });
---    

#### Delete attachment
---
	return Promise.map(docids, function(docid){
        return couchProvider.getDocument(docid, codename)
        .then(function(doc){
            return couchProvider.deleteAttachment(doc, "testname/README.md", codename);
        })
        .then(function(res){
            console.log(res);
        });
    });
---

#### Delete document
---
    return Promise.map(docids, function(docid){
        return couchProvider.getDocument(docid, codename)
        .then(function(doc){
            return couchProvider.deleteDocument(doc, codename);
        })
        .then(function(res){
            console.log("Document deleted", res);
        });
    });
---

#### Get view from db
---
	couchProvider.getView('_design/user/_view/info')
	.then(function(data){
		console.log(data);//Array of documents
	});
---

#### Get view from db using an object as query (querystring)
---
	var obj_query = {
		key: 'someuserid',
		include_docs: true
	}

	couchProvider.getViewQs('_design/user/_view/info', obj_query)
	.then(function(data){
		console.log(data);//Array of documents
	});
---

### Hapi plugin

---
	/*
	*	To use as an Hapi plugin, the methods will be available to your server application as server.methods.yourserverapp.*
	*	@server Hapi server object
	*	@couchdbconfig  couchdb configuration object with multiple databases, optionally use only one database
	*   @namespace      Optional namespace. The methods will be added to the Hapi server. For this example,
	*					the methods will be made available as server.methods.yourserverapp.*
	*					By default the namespace is couchprovider
	*/
	var plugin = {};
    plugin.register = require('couch-provider');
    plugin.options = couchdbconfig;
----

#### Configuration sample for Hapi

The namespace field is used to create the functions in your Hapi server. 
Leave blank and the functions will be added under namespace 'couchprovider'

Using the 'Hapi' server object, you can call couchprovider functions from anywhere in your application 
as 'server.methods.<your namespace or couchprovider>.uploadDocuments(docs)'

----
	//Multiple db configuration, namespace is optional, you can add multiple namespaces by providing an array
	var couchdbconfig = {
		"default" : "db1",
		"db1" : {
			"hostname": "http://localhost:5984",
			"database": "users1",
			"datapath": "/some/path/in/server"
		},
		"db2" : {
			"hostname": "http://yourdomain.com",
			"database": "users2"
		},
		"namespace": "yourserverapp"
	}

	var server = new Hapi.Server();

	var plugins = [];

    var plugin = {};
	plugin.register = require('couch-provider');
	plugin.options = couchdbconfig;
	plugins.push(plugin);

    server.register(plugins, function(err){
        if (err) {
            throw err; // something bad happened loading the plugin
        }
    });
    
    server.start(function () {
        console.log("The server has started");
    });
---


### Documents migration

Create your migration document scheme. It must export two functions 'getDocuments' and 'transformDocument'

In this example, we want to add new fields to a 'user' document
Example: 'migrate_userinfo.js'

----
	const qs = require('querystring');
	const _ = require('underscore');

	module.exports.getDocuments = function(couchProvider){

		var key = {
			include_docs: true
		}

		var v = '_design/user/_view/info';
		v += '?' + qs.stringify(key);

		return couchProvider.getView(v)
		.then(function(res){
			return _.pluck(res, 'doc');
		});
	}

	module.exports.transformDocument = function(doc){
		if(!doc.new_user_field){
			var transformed = {...doc, 
				"new_user_field": "new_data"
			}

			return transformed;
		}else{
			console.error("transformed not made", doc);
			return null;
		}
	}
----

#### Setting up a migration

If using as a Hapi plugin, you can also add the 'migrations' field in your configuration. 
When the server starts, the migration will be executed. 

----
	const conf = {
		"default" : "somedb",
		"somedb" : {
			"hostname": "http://localhost:5984",
			"database": "mydb"
		},
		"migrations": [
			"/path/to/migrate_userinfo.js"
		]
	}

	const {CouchMigrations} = require('couch-provider');
	const couchMigrations = new CouchMigrations();
	couchMigrations.setConfiguration(conf);
	couchMigrations.migrate();
----
