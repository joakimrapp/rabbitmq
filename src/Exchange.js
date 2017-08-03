module.exports = ( log, Publisher, Queue ) => {
	class Exchange {
		constructor( connection, type = 'topic', name, options = {} ) {
			Object.assign( this, { context: {
				connection,
				name,
				type,
				options,
				exchange: undefined,
				waiting: undefined,
				clients: []
			} } );
		}
		assert( channel ) {
			const context = this.context;
			return context.exchange ? Promise.resolve( context.exchange.exchange ) : new Promise( ( resolve, reject ) => {
				if( context.exchange )
					resolve( context.exchange.exchange );
				else if( context.waiting )
					context.waiting.push( { resolve, reject } );
				else {
					context.waiting = [];
					log.trace( `asserting exchange`, `${context.name} (${context.type})` );
					channel.promise
						.then( channel =>
							channel.assertExchange( context.name, context.type, context.options ) )
						.then( data => {
							log.debug( 'exchange asserted', context.name );
							channel.listener( () => ( context.exchange = undefined ) );
							context.exchange = data;
							while( context.waiting.length )
								process.nextTick( context.waiting.shift().resolve, data.exchange );
							resolve( data.exchange );
						} )
						.catch( ( err ) => {
							while( context.waiting.length )
								process.nextTick( context.waiting.shift().reject, err );
							reject( err );
						} );
				}
			} );
		}
		close() {
			const context = this.context;
			return Promise.all( context.clients.map( client => client.close() ) );
		}
		publisher( confirm = false ) {
			const publisher = new Publisher( this.context.connection, this, confirm );
			this.context.clients.push( publisher );
			return publisher;
		}
		get queue() {
			const context = this.context;
			const parts = [];
			return new Proxy( ( name, options ) => {
				const queue = new Queue( this.context.connection, this, name, options );
				this.context.clients.push( queue );
				return queue;
			}, {
				get: ( target, part, proxy ) => {
					parts.push( part );
					return proxy;
				},
				apply: ( target, thisArg, [ options ] ) =>
					target( parts.join( '.' ), options )
			} );
		}
	}
	return Exchange;
};
