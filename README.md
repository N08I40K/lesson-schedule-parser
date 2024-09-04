# Бот-парсер расписания пар политехникума.

## Инструкция по установке `Ubuntu 22.04.4 LTS`

[Установка Docker](https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository)
```
wget https://github.com/N08I40K/lesson-schedule-parser/releases/download/[[release tag]]/build.tar

mkdir lesson-schedule-parser
cd lesson-schedule-parser

tar -xf ../build.tar

# Не обязательно.
rm ../build.tar

sudo docker compose up --detach
sudo docker compose down

echo BOT_TOKEN="telegram-bot-token" >> /var/lib/docker/volumes/lesson-schedule-parser_data/_data/.env
nano /var/lib/docker/volumes/lesson-schedule-parser_data/_data/configuration.json
# В редакторе меняем идентификатор аккаунта администратора на свой и добавляем идентификаторы чатов в список subscribers.

sudo docker compose up --detach
```
