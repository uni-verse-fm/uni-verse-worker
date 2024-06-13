![GitHub Release](https://img.shields.io/github/v/release/uni-verse-fm/uni-verse-worker?sort=semver&display_name=release&style=for-the-badge&label=WORKER%3ARELEASE&cacheSeconds=3600)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/uni-verse-fm/uni-verse-worker/ci.yml?style=for-the-badge&label=WORKER%3AChecks&logo=eslint)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/uni-verse-fm/uni-verse-worker/build.yml?style=for-the-badge&label=WORKER%3ABuild&logo=nodedotjs)

# Worker Uni-verse

Uni-verse est une plateforme de streaming audio conçue spécifiquement pour les producteurs de musique.
Elle consiste en un site web, une application smartphone, et une API.

Ce projet est le worker de Uni-verse.

Il consomme une queue RabbitMQ et effectue des taches en fonction de ce qu'il reçoit.

L'image docker de ce worker est basée sur une image permettant de faire tourner [Olaf](https://github.com/JorenSix/Olaf), l'outil de fingerprinting que nous utilisons.


## Utilisation:

### Configuration
Ce worker a besoin de differentes variables pour fonctionner. Ces variables lui sont passées par l'environnement au moment ou l'application est lancée. il peut s'agir de l'environnement Kubernetes, ou d'un fichier d'env.

Les variables sont les suivantes:
```
RMQ_URL=rabbitmq
RMQ_PORT=5672
RMQ_USER=guest
RMQ_PASSWORD=guest
MINIO_ENDPOINT=minio
MINIO_PORT=9000
TASK=search
API_HOST=localhost
API_PORT=3000
```

RMQ signifie "rabbitMQ". Cette partie de la configuration spécifie à quel hote RMQ le worker doit se connecter.

On doit aussi préciser comment joindre Minio ainsi que l'API.


Task est uen variable qui peut avoir deux valeurs : `register` ou `search`. Selon ce que l'on met, le worker ne se comportera pas de la même façon.

- register: Le worker ira chercher un nom de fichier dans la queue `uni-verse-fp-in` et téléchargera ce fichier pour l'enregister dans la base de fingerprints.

- search: Le worker ira chercher un nom de fichier dansl a queue `uni-verse-fp-search` et téléchargera ce fichier dans le bucket "extracts" pour ensuite le comparer à sa base. Une fois le resultat trouvé elle renvoie l'ID de la track identifiée à l'API par une requête HTTP.

### Développemnt

Pour le développement, on peut utiliser ce répos avec le docker-compose de l'[API de uni-verse](https://github.com/uni-verse-fm/uni-verse-api). Celui-ci bind un volume afin de ne pas avoir à re build l'image docker de ce répo pour chaque changement.

### Produciton
Pour la production, ce répos contient deux déploiements et un PVC qui permettent de déployer des workers sur kubernetes.

Les variables necessaires au worker sont alors fournies par la configmap, sauf `task` qui est directement dans le déploiement.
