require( '@jrapp/node-project-setup' ).testing.file( './test' )( ( rabbitmq ) => ( {
	asset1: true
} ) )
	.describe( 'rabbitmq.function1' )
		.it( 'should do something', ( assert, rabbitmq, { asset1 } ) => new Promise( resolve => {
			resolve();
		} ) )
		.done()
	.describe( 'rabbitmq.function2' )
		.it( 'should do something', ( assert, rabbitmq, { asset1 } ) => new Promise( resolve => {
			resolve();
		} ) )
		.done()
	.done();
