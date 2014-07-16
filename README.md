iLab node.js
=================

The node.js implementation of the iLab Shared Architecture has split into separate GitHub repositories. This repository remains as a redirection to the new ones.

All of the servers are written in node.js, making them platform independent and very lightweight. The service broker is compatible with both the original MIT batched lab servers and with the new node.js lab servers. This implementation of the iLab Shared Architecture is the only one that can accept customised authentication schemes such as LTI. If you want to embed iLabs directly and seamlessly into your learning management system, the node.js implementation is for you. 

Not to mention it's free, compatible with existing labs and incredibly easy to setup and use! 

###[Service Broker](https://github.com/ShadovvMoon/Broker)

*A service broker for each institution.*

The service broker provides a global administration to control access to lab servers for an institution. This is useful when you have several [agents](https://github.com/ShadovvMoon/Agent) with different permissions.

###[Lab Server](https://github.com/ShadovvMoon/Lab)

*A lab server for each piece of laboratory equipment.*

The lab server provides an easy and secure way to put your laboratory equipment online. 

###[Agent](https://github.com/ShadovvMoon/Agent)

*An agent for each course.*

Agents are lightweight servers that easily allow experiments to be seamlessly embedded in a variety of systems such as edX, Blackboard, Moodle etc. 