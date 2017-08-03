module.exports = ( log ) => {
	class Channel {
		constructor( connection, confirm = false ) {
			Object.assign( this, { context: {
				connection,
				confirm,
				channel: undefined,
				waiting: undefined,
				listeners: []
			} } );
		}
		get promise() {
			const context = this.context;
			return context.channel ? Promise.resolve( context.channel ) : new Promise( ( resolve, reject ) => {
				if( context.channel )
					resolve( context.channel );
				else if( context.waiting )
					context.waiting.push( { resolve, reject } );
				else {
					context.waiting = [];
					log.trace( context.confirm ? 'creating confirmed channel' : 'creating channel', context.connection.display );
					context.connection.promise
						.then( connection =>
							( context.confirm ? connection.createChannel() : connection.createConfirmChannel() ) )
						.then( channel => {
							context.channel = channel;
							log.debug( 'channel created', context.connection.display );
							channel.on( 'close', () => {
								context.channel = undefined;
								while( context.listeners.length )
									process.nextTick( context.listeners.shift() );
							} );
							while( context.waiting.length )
								process.nextTick( context.waiting.shift().resolve, channel );
							resolve( channel );
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
			return this.context.channel ? this.context.channel.close() : Promise.resolve();
		}
		listener( onFulfilled ) {
			this.context.listeners.push( onFulfilled );
			return this;
		}
	}
	return Channel;
};
