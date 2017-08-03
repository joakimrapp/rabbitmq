module.exports = ( log, Channel ) => {
	class Publisher {
		constructor( connection, exchange, confirm ) {
			Object.assign( this, { context: {
				confirm,
				channel: new Channel( connection, confirm ),
				exchange
			} } );
		}
		publish( routingKey, content, options = {} ) {
			const context = this.context;
			return context.exchange.assert( context.channel )
				.then( exchange => context.channel.promise
			 		.then( channel => {
						const buffer = content instanceof Buffer ? content : Buffer.from( JSON.stringify( content ) );
						return !context.confirm ?
							channel.publish( exchange, routingKey, buffer, options ) :
							new Promise( ( resolve, reject ) => {
						 		channel.publish( exchange, routingKey, buffer, options, ( err ) =>
									err ? reject( err ) : resolve() );
							} );
					} ) );
		}
		close() {
			return this.context.channel.close();
		}
	}
	return Publisher;
};
