module.exports = ( log, Channel ) => {
	class Queue {
		constructor( connection, exchange, name, options = {} ) {
			Object.assign( this, { context: {
				name,
				options: Object.assign( name ? {
					exclusive: false,
					autoDelete: false
				} : {
					exclusive: true,
					autoDelete: true
				}, options ),
				exchange,
				channel: new Channel( connection ),
				queue: undefined,
				consume: undefined,
				pattern: '*',
				prefetch: undefined,
				ack: false
			} } );
		}
		assert() {
			const context = this.context;
			return context.queue ? Promise.resolve( context.queue.queue ) : new Promise( ( resolve, reject ) => {
				if( context.queue )
					resolve( context.queue.queue );
				else if( context.waiting )
					context.waiting.push( { resolve, reject } );
				else {
					context.waiting = [];
					log.trace( `asserting queue`, context.name );
					context.exchange.assert( context.channel )
						.then( exchange => context.channel.promise
							.then( channel => channel.assertQueue( context.name, context.options )
								.then( data => channel.bindQueue( data.queue, exchange, this.context.pattern )
								 	.then( () => {
										log.debug( 'queue asserted', context.name );
										context.channel.listener( () => ( context.queue = undefined ) );
										context.queue = data;
										while( context.waiting.length )
											process.nextTick( context.waiting.shift().resolve, data.queue );
										resolve( data.queue );
									} ) ) ) )
						.catch( ( err ) => {
							while( context.waiting.length )
								process.nextTick( context.waiting.shift().reject, err );
							reject( err );
						} );
				}
			} );
		}
		pattern( pattern ) {
			this.context.pattern = pattern;
			return this;
		}
		prefetch( prefetch ) {
			Object.assign( this.context, { prefetch, ack: true } );
			return this;
		}
		static consume( queue, handler ) {
			const context = queue.context;
			return queue.assert()
				.then( queue => context.channel.promise
					.then( channel => ( context.prefetch > 0 ? channel.prefetch( context.prefetch ) : Promise.resolve() )
				 		.then( () => context.ack ?
							channel.consume( queue, ( message ) => Promise.resolve( handler( message.content ) )
									.then( () => channel.ack( message ) )
									.catch( ( err ) => log.warning( 'handler failed', err ) || channel.nack( message, false, false ) ),
								{ noAck: false } ) :
							channel.consume( queue, ( message ) => Promise.resolve( handler( message.content ) )
									.catch( ( err ) => log.error( 'handler failed', err ) ),
								{ noAck: true } ) )
						.then( ( consume => ( context.consume = consume ) ) ) ) );
		}
		get consume() {
			return {
				json: ( handler ) => Queue.consume( this, ( content ) => handler( JSON.parse( content.toString() ) ) ),
				buffer: ( handler ) => Queue.consume( this, handler )
			};
		}
		close() {
			const context = this.context;
			return ( !context.consume ?
					Promise.resolve() :
					context.channel.promise.then( channel => channel.cancel( context.consume.consumerTag ) ) )
				.then( () => context.channel.close() );
		}
	}
	return Queue;
};
