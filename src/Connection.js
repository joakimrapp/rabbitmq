module.exports = ( log, Exchange ) => {
	class Connection {
		constructor( {
			username = 'guest',
			password = 'guest',
			host = 'localhost',
			port = '5672',
			attempts = 10,
			wait: {
				milliseconds = 0,
				seconds = 0,
				minutes = 0
			} = {}
		} = {} ) {
			Object.assign( this, { context: {
				display: `${username}@${host}`,
				url: `amqp://${username}:${password}@${host}:${port}`,
				attempts,
				wait: milliseconds + ( seconds * 1000 ) + ( minutes * 60 * 1000 ),
				connection: undefined,
				waiting: undefined,
				exchanges: []
			} } );
		}
		static wait( milliseconds ) {
			return new Promise( resolve => setTimeout( resolve, milliseconds ) );
		}
		static connect( context, attempt = 1 ) {
			log.trace( 'connecting', context.attempts ?
				`${context.display} (attempt ${attempt} of ${context.attempts})` :
				`${context.display} (attempt ${attempt})` );
			const timer = log.timer();
			const retry = ( !context.attempts ) || ( context.attempts > attempt );
			let promise = require( 'amqplib' ).connect( context.url )
				.then( ( connection ) =>
					timer.trace( 'connected', context.display ).return( connection ) );
			return retry ? promise : promise.catch( ( err ) => {
				timer.warning( 'connection failed', `${context.display} (retrying in ${( context.wait ).toFixed( 2 )} seconds)` );
				return Connection.wait( context.wait )
					.then( () => Connection.connect( context, attempt + 1 ) );
			} );
		}
		get display() {
			return this.context.display;
		}
		get promise() {
			const context = this.context;
			return context.connection ? Promise.resolve( context.connection ) : new Promise( ( resolve, reject ) => {
				if( context.connection )
					resolve( context.connection );
				else if( context.waiting )
					context.waiting.push( { resolve, reject } );
				else {
					context.waiting = [];
					log.debug( 'connecting', context.display );
					log.timer( Connection.connect( context ) ).debug( 'connected', context.display ).promise
						.then( ( connection ) => {
							context.connection = connection;
							connection.on( 'close', () => ( context.connection = undefined ) );
							connection.on( 'error', ( err ) =>
								log.error( 'connection is failing', err ) );
							while( context.waiting.length )
								process.nextTick( context.waiting.shift().resolve, connection );
							resolve( connection );
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
			return Promise.all( context.exchanges.map( exchange => exchange.close() ) )
				.then( () => {
					if( context.connection )
						log.trace( 'closing connection', context.display );
						return log.timer( context.connection.close() )
							.debug( 'connection closed', context.display ).promise;
				} );
		}
		get exchange() {
			const context = this.context;
			const parts = [];
			return new Proxy( ( name, type, options ) => {
				const exchange = new Exchange( this, type, name, options );
				this.context.exchanges.push( exchange );
				return exchange;
			}, {
				get: ( target, part, proxy ) => {
					parts.push( part );
					return proxy;
				},
				apply: ( target, thisArg, [ type, options ] ) =>
					target( parts.join( '.' ), type, options )
			} );
		}
	}
	return Connection;
};
