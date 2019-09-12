exports.plugin = {};

const CouchProvider = require('./couch.provider');
const CouchMigrations = require('./couch.migrations');

const couchProvider = new CouchProvider();
exports.couchProvider = couchProvider;


exports.plugin.register = async function (server, conf) {
	
    couchProvider.setConfiguration(conf);
    var namespace = 'couchprovider';

    if(conf.namespace){
    	namespace = conf.namespace;
    }

    var addNameSpace = function(namespace){
    	server.method({
		    name: namespace + '.getCouchDBServer',
		    method: couchProvider.getCouchDBServer,
		    options: {
		    	bind: couchProvider
		    }
		});

		server.method({
		    name: namespace + '.uploadDocuments',
		    method: couchProvider.uploadDocuments,
		    options: {
		    	bind: couchProvider
		    }
		});

		server.method({
		    name: namespace + '.getDocument',
		    method: couchProvider.getDocument,
		    options: {
		    	bind: couchProvider
		    }
		});

		server.method({
		    name: namespace + '.deleteDocument',
		    method: couchProvider.deleteDocument,
		    options: {
		    	bind: couchProvider
		    }
		});

		server.method({
		    name: namespace + '.addDocumentAttachment',
		    method: couchProvider.addDocumentAttachment,
		    options: {
		    	bind: couchProvider
		    }
		});

		server.method({
		    name: namespace + '.getDocumentStreamAttachment',
		    method: couchProvider.getDocumentStreamAttachment,
		    options: {
		    	bind: couchProvider
		    }
		});

		server.method({
		    name: namespace + '.getDocumentStreamAttachmentUri',
		    method: couchProvider.getDocumentStreamAttachmentUri,
		    options: {
		    	bind: couchProvider
		    }
		});

		server.method({
		    name: namespace + '.getDocumentAttachment',
		    method: couchProvider.getDocumentAttachment,
		    options: {
		    	bind: couchProvider
		    }
		});

		server.method({
		    name: namespace + '.getView',
		    method: couchProvider.getView,
		    options: {
		    	bind: couchProvider
		    }
		});

		server.method({
		    name: namespace + '.getViewQs',
		    method: couchProvider.getViewQs,
		    options: {
		    	bind: couchProvider
		    }
		});

		server.method({
		    name: namespace + '.mkdirp',
		    method: couchProvider.mkdirp,
		    options: {
		    	bind: couchProvider
		    }
		});

		server.method({
		    name: namespace + '.removeDirectorySync',
		    method: couchProvider.removeDirectorySync,
		    options: {
		    	bind: couchProvider
		    }
		});

		console.info('couch-provider namespace', namespace, 'initialized.');
    }


    if(Array.isArray(namespace)){
    	namespace.forEach(function(ns){
    		addNameSpace(ns);
    	});
    }else{
    	addNameSpace(namespace);
    }

    if(conf.migrations){
    	var couchMigrations = new CouchMigrations();
    	couchMigrations.setConfiguration(conf);
    	couchMigrations.migrate();
    }
}

exports.plugin.pkg = require('./package.json');
