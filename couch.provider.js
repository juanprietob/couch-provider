const request = require('request');
const _ = require('underscore');
const Promise = require('bluebird');
const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs');
const concat = require('concat-stream');
const { PassThrough, Writable } = require('stream');

module.exports = class CouchProvider{

	constructor(){
		this.configuration = {};
	}

	setConfiguration(conf){
		if(!conf || !conf.default && !conf.hostname && !conf.database){
			var confexample = {
				"default": "codename",
				"codename" : {
					"hostname" : "http://localhost:5984",
					"database" : "db"
				}
			}
			console.error("No default database name, your conf should look like:", JSON.stringify(confexample, null, 2), "or", JSON.stringify(confexample.codename, null, 2))
			throw "Bad couchdb configuration";
		}
		this.configuration = conf;
	}

	createDB(codename){
		const self = this;

	    return new Promise(function(resolve, reject){

	    	var options = {
	    		uri: self.getCouchDBServer(codename),
	            method: 'PUT', 
	            json : true
	    	}

	        request(options, function(err, res, body){
	            if(err){
	                reject(err.message);
	            }else{
	                try{
	                    if(body.error === "not_found"){
	                        request(options, function(err, res, body){
	                            resolve(body);
	                        });
	                    }else{
	                        resolve(body);
	                    }
	                }catch(e){
	                    console.error(url);
	                    console.error(e);
	                    reject(e);
	                }
	            }
	        });
	    });
	}

	getConfiguration(codename){
		const self = this;

		if(codename){
			return self.configuration[codename];
		}else if(self.configuration.default){
			return self.configuration[self.configuration.default];
		}else{
			return self.configuration;
		}
	}

	getCouchDBServer(codename){
		const self = this;

		var conf = self.getConfiguration(codename);

		if(!conf){
			throw "No couchdb server found in configuration with " + codename;
		}

		var url = conf.hostname + "/" + conf.database;

		return url;

	}

	uploadDocuments(docs, codename){

		const self = this;
		
		var alldocs = {};

		if(_.isArray(docs)){
			alldocs["docs"] = docs;
		}else if(_.isObject(docs)){
			alldocs["docs"] = [docs];
		}

	    return new Promise(function(resolve, reject){
	        var options = { 
	            uri: self.getCouchDBServer(codename) + "/_bulk_docs",
	            method: 'POST', 
	            json : alldocs
	        };
	        
	        request(options, function(err, res, body){

	            if(err){
	            	reject({"id" : "uploadDocumentsDataProvider", "message" : err.message});
	            }else if(body.error){
	            	reject(body.error);
	            }else{
	            	resolve(body);
	            }
	        });
	    });
	}

	getDocument(id, codename){
		const self = this;

		return new Promise(function(resolve, reject){
			try{
				var options = {
					uri: self.getCouchDBServer(codename) + "/" + id,
					json: true
				}
				request(options, function(err, res, body){
					if(err){
						reject(err);
					}else{
						if(body.error){
							reject(body.error);
						}else{
							resolve(body);
						}
					}
				});

			}catch(e){
				reject(e);
			}
		});
	}

	mkdirp(path){
		const self = this;

		return new Promise(function(resolve, reject){
			mkdirp(path, function(err){
				if(err){
					reject(err);
				}else{
					resolve(true);
				}
			});
		});
	}

	removeDirectorySync(dirpath){
		const self = this;

		if(fs.existsSync(dirpath) && fs.statSync(dirpath).isDirectory()){
			_.map(fs.readdirSync(dirpath), function(filename){
				var fullpath = path.join(dirpath, filename);
				if(fs.existsSync(fullpath)){
					if(fs.statSync(fullpath).isDirectory()){
						self.removeDirectorySync(fullpath);
					}else{
						fs.unlinkSync(fullpath);
					}
				}else{
					//Does not exists try to remove anyway, probably a dead symlink
					try{
						fs.unlinkSync(fullpath);
					}catch(e){
						console.error(e);
					}
				}
			});
			fs.rmdirSync(dirpath);
		}
	}

	deleteDocument(doc, codename){
		const self = this;

		if(doc.attachments){
			var conf = self.getConfiguration(codename);
			var dirpath = path.join(conf.datapath, doc._id);
			if(dirpath === conf.datapath){
				throw "Something is terrible wrong with the doc._id";
			}
			self.removeDirectorySync(dirpath);
		}

		return new Promise(function(resolve, reject){
			try{
				var options = {
					uri: self.getCouchDBServer(codename) + "/" + doc._id,
					method: 'DELETE',
					qs: {
						rev: doc._rev
					},
					json: true
				}				
				request(options, function(err, res, body){
					if(err){
						reject(err);
					}else{
						if(body.error){
							reject(body);
						}else{
							resolve(body);
						}
					}
				});

			}catch(e){
				reject(e);
			}
		});
	}

	deleteAttachment(doc, name, codename){
		const self = this;

		return new Promise(function(resolve, reject){

			if(doc.attachments && doc.attachments[name]){

				var conf = self.getConfiguration(codename);
				var filepath = path.join(conf.datapath, doc.attachments[name].path);

				try{
					fs.unlinkSync(filepath);

					var docdir = path.normalize(path.join(conf.datapath, doc._id));

					while(path.normalize(filepath) !== docdir){
						filepath = path.dirname(filepath);
						if(fs.statSync(filepath).isDirectory() && fs.readdirSync(filepath).length === 0){
							fs.rmdirSync(filepath);
						}
					}

					delete doc.attachments[name];
					self.uploadDocuments(doc, codename)
					.then(function(res){
						resolve(res[0]);
					});
				}catch(e){
					reject(e);
				}

			}else if(doc._attachments && doc._attachments[name]){
				try{
					var options = {
						uri: self.getCouchDBServer(codename) + "/" + doc._id + "/" + name,
						method: 'DELETE',
						qs: {
							rev: doc._rev
						},
						json: true
					}				
					request(options, function(err, res, body){
						if(err){
							reject(err);
						}else{
							if(body.error){
								reject(body);
							}else{
								resolve(body);
							}
						}
					});

				}catch(e){
					reject(e);
				}
			}else{
				throw {
					error: "Attachement not found"
				}
			}
		});
	}

	addDocumentAttachment(doc, name, stream, codename){
		const self = this;

		return new Promise(function(resolve, reject){

			var conf = self.getConfiguration(codename);

			if(conf.datapath){
				var dirpath = path.join(conf.datapath, doc._id);
				var fullpath = path.join(dirpath, name);
				
				// The name may contain folders (name = dir1/dir2/actualfilename) so we need to create it recursively to be safe
				self.mkdirp(path.dirname(fullpath))
				.then(function(){

					var filepath = path.join(doc._id, name);
					
					var writestream = fs.createWriteStream(fullpath);
					writestream.on('finish', function(err){

						if(!doc.attachments){
							doc.attachments = {};
						}

						doc.attachments[name] = {
				            "path": filepath
						}
						self.uploadDocuments([doc], codename)
						.then(function(res){
							resolve(res[0]);
						})
						.catch(reject)

					})
					stream.pipe(writestream);
				});
				
			}else{
				try{
					var options = {
						uri: self.getCouchDBServer(codename) + "/" + doc._id + "/" + encodeURIComponent(name),
						method: 'PUT',
						headers: {
							"Content-type" : "application/octet-stream"
						},
						qs: {
							rev: doc._rev
						},
						json: true
					}
					stream.pipe(request(options, function(err, res, body){
						if(err){
							reject(err);
						}else{
							resolve(body);

						}
					}));
				}catch(e){
					reject(e);
				}
			}
			
		});
	}

	getDocumentStreamAttachmentUri(doc, name, codename){
		const self = this;

		if(doc.attachments && doc.attachments[name]){

			var conf = self.getConfiguration(codename);

			var filepath = path.join(conf.datapath, doc._id, name);

			if(!fs.existsSync(filepath)){
				throw "File not found";
			}
			return Promise.resolve({file: filepath});
		}else if(doc._attachments && doc._attachments[name]){
			return Promise.resolve({uri: self.getCouchDBServer(codename) + "/" + doc._id + "/" + name});
		}else{
			return Promise.reject("Document is missing attachment");
		}
	}

	getDocumentStreamAttachment(doc, name, codename){
		const self = this;

		return self.getDocumentStreamAttachmentUri(doc, name, codename)
		.then(function(uri){
			if(uri.file){
				return Promise.resolve(fs.createReadStream(uri.file));
			}else if(uri.uri){
				var pass = new PassThrough();
				request(uri).pipe(pass);
				return Promise.resolve(pass);
			}else{
				return Promise.reject("Document is missing attachment");
			}
		})
	}

	getDocumentAttachment(doc, name, codename){
		const self = this;

		return new Promise(function(resolve, reject){
			return self.getDocumentStreamAttachment(doc, name, codename)
			.then(function(stream){
				var concatStream = concat(resolve);
				stream.pipe(concatStream);
				stream.on('error', reject);
			})
			.catch(reject);	
		});
	}

	getView(view, codename){
		const self = this;

		return new Promise(function(resolve, reject){
			try{
				var options = {
					uri: self.getCouchDBServer(codename) + "/" + view,
					json: true
				}

				request(options, function(err, res, body){					
					if(err){						
						reject(err);
					}else{
						resolve(body.rows);
					}					
				});
			}catch(e){
				reject(e);
			}
		})
	}

	getViewQs(view, query, codename){
		const self = this;
		
		return new Promise(function(resolve, reject){
			try{
				var options = {
					uri: self.getCouchDBServer(codename) + "/" + view,
					qs: query,
					json: true
				}

				request(options, function(err, res, body){					
					if(err){						
						reject(err);
					}else{
						resolve(body.rows);
					}					
				});
			}catch(e){
				reject(e);
			}
		})
	}
}