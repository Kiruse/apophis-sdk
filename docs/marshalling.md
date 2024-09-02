# Apophis SDK Marshalling
A while ago, I developed my `@kiruse/marshal` library as a means to provide an extensible, reusable, composable, and flexible marshalling framework. It has many advantages over most alternatives:

- It can handle JSON.
- It can handle Protobufs.
- It can unmarshal into proper class instances.
- It is composable: You can extend existing marshallers to create new ones, and upon altering the underlying marshaller, derived marshallers immediately see the change.
- It is extensible: You can implement your own marshal units to support new types.
- It is reusable: You can reuse marshal units from other libraries.
- It is flexible: You can add inject new marshal units into existing marshallers to extend base functionality of third party libraries (if they allow it).

Apophis leverages this library to support polymorphism of Cosmos blockchain data types. Chain Integrations allow registering different marshal units for different chains whilst retaining the same high level interface.
