const request = require('request');
const _ = require('underscore');
const Promise = require('bluebird');
const path = require('path');
const CouchProvider = require('./couch.provider');

module.exports = class CouchMigrations extends CouchProvider{
	constructor(){
		super();
    }

    getMigrations(){
    	const {migrations} = this.configuration;
    	return migrations;
    }

    migrate(){
    	const self = this;
    	return Promise.map(self.getMigrations(), function(migration_path){
    		
    		console.log("Migrating", migration_path);

    		const migration = require(migration_path);

    		return migration.getDocuments(self)
    		.then(function(res){
    			return Promise.map(res, function(doc){
    				return migration.transformDocument(doc);
    			});
    		})
    		.then(function(docs){
    			return _.compact(docs);
    		})
    		.then(function(docs){
    			console.log("Updating documents", docs);
    			return self.uploadDocuments(docs);
    		})
    	});
    }
}