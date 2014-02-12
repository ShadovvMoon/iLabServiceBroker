iLabServiceBroker
=================

iLab ServiceBroker achitecture using nodejs
Developed by Sam Colbran

Tools required:
nodejs

##Broker
The new service broker provides a different service from the original MIT broker. All student interaction, such as authentication and client software, has been moved into a separate service. The purpose of the new service broker is to bridge communication between json and SOAP (for legacy lab servers).
The most basic broker converts json requests into SOAP and then sends it directly to the lab server. Additional caching or other logic may be incorporated.
The service broker provides a global administration to control access to lab servers. This is useful when you have several agents with different permissions.

####Installation
```
cd <path to broker directory>
npm install
node index.js
```

Open a web browser and navigate to http://localhost:8080. Login with the username and password admin and password respectively. Click the Admin drop down menu in the upper right hand corner and then select My Account. Enter password as the old password, then type in a new password and click Save.



##Agent
An agent is designed to provide a way of ‘modifying broker behaviour’ without making any changes to the broker source code. This is useful for access control and keeping the system stable. 
All actions supported by the broker are also supported by the agent. The most basic agent acts as a wrapper for commands (simply passing commands through to the broker). A more advanced agent could introduce logic inside commands or other authentication systems.

####Installation
```
cd <path to agent directory>
npm install
node index.js
```

####Settings
To successfully start the agent you will need to complete the required fields shown below in the config.js file:
```
config.broker_host   = 'localhost';
config.broker_port   = 8080;

//Agent info
config.wrapper_uid   = '';
config.wrapper_key   = '';
```

The wrapper_uid and wrapper_key correspond to the GUID and Passkey in the broker admin panel. These do not need to follow any set format (a random string of any length is suitable). ASCII characters are required.
