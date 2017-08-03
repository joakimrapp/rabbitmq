const log = require( '@jrapp/log-emitter' ).log( 'rabbitmq' );
const Channel = require( './Channel.js' )( log );
const Publisher = require( './Publisher.js' )( log, Channel );
const Queue = require( './Queue.js' )( log, Channel );
const Exchange = require( './Exchange.js' )( log, Publisher, Queue );
const Connection = require( './Connection.js' )( log, Exchange );
module.exports = ( options ) => new Connection( options );
