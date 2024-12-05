import Discord from "discord.js"

const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent
  ]
})

client.on("ready", () => {
  console.log(`${client.user.username} online`)
})

function makeEmbed(args) {
  const embed = new Discord.EmbedBuilder()
  if (args.title) embed.setTitle(args.title)
  if (args.description) embed.setDescription(args.description)
  if (args.author) embed.setAuthor(args.author)
  if (args.footer) embed.setFooter(args.footer)
  if (args.thumbnail) embed.setThumbnail(args.thumbnail)
  if (args.image) embed.setImage(args.image)
  if (args.timestamp) embed.setTimestamp(args.timestamp)
  embed.setColor("#" + process.env.COLOUR)
  return embed
}

const tenorMatch = /^https:\/\/media\.tenor\.com\/([a-zA-Z0-9_-]+)e\/[a-zA-Z0-9_-]+\.png$/

client.on("messageCreate", async message => {
  if (message.guild) {
    const matches = Array.from(message.content.matchAll(/discord\.com\/channels\/(\d{17,19})\/(\d{17,19})(?:\/(\d{17,19}))?(?:[^\d\/](?<!\>)|$)/g))
    if (!matches.length) return

    const done = new Set
    const embeds = []
    let charCount = 0

    function countEmbedChars(embed) {
      charCount += embed.data.author?.name?.length + embed.data.footer?.text?.length
      if (embed.data.description) charCount += embed.data.description.length
      if (embed.data.fields) for (const field of embed.data.fields) charCount += field.name.length + field.value.length
      if (charCount > 6000) return true
    }

    for (const match of matches) {
      if (match[1] !== message.guildId) continue
      const channel = await client.channels.fetch(match[2])
      if (!channel) continue

      if (!match[3] && (channel.type === Discord.ChannelType.PublicThread || channel.type === Discord.ChannelType.PrivateThread)) {
        const parent = await client.channels.fetch(channel.parentId)

        if (parent.type === Discord.ChannelType.GuildForum) {
          const starter = await channel.fetchStarterMessage().catch(() => {})
          if (!starter) continue

          const id = `${match[1]},${match[2]},${starter.id}`
          if (done.has(id)) continue

          if (!starter.member) {
            Object.defineProperty(starter, "member", {
              value: starter.author
            })
          }

          const embed = makeEmbed({
            author: {
              name: `Forum post by ${starter.member.displayName ?? "Unknown Member"}`,
              iconURL: "https://wynem.com/assets/images/icons/quote.webp",
              url: `https://discord.com/channels/${starter.guildId}/${starter.channelId}/${starter.id}`
            },
            footer: {
              text: `Quoted by ${message.member.username}`,
              iconURL: message.member.displayAvatarURL({
                extension: Discord.ImageFormat.PNG
              })
            },
            thumbnail: starter.member.displayAvatarURL({
              extension: Discord.ImageFormat.PNG,
              size: 64
            }),
            timestamp: starter.createdTimestamp,
            title: channel.name,
            description: starter.content
          })

          let image
          if (starter.attachments.size !== 0) {
            const attachment = starter.attachments.first()
            if (attachment.contentType.startsWith("image/")) {
              embed.setImage(attachment.url)
              image = true
            } else embed.addFields({
              name: "Attached file",
              value: `**[${attachment.name}](${attachment.url})**`
            })
          }
          if (!image) {
            const url = starter.content.match(/https?:\/\/\S*?\.(png|jpe?g|gif|webp)/i)
            if (url) {
              embed.setImage(url[0].replace(/\s/g, ""))
            }
          }

          if (countEmbedChars(embed)) break

          embeds.push(embed)
          done.add(id)
          if (embeds.length > 9) break
        }
        continue
      }

      const id = `${match[1]},${match[2]},${match[3]}`
      if (done.has(id)) continue

      const quote = await channel.messages.fetch(match[3]).catch(() => {})
      if (!quote) continue

      if (!quote.member) {
        Object.defineProperty(quote, "member", {
          value: quote.author
        })
      }

      const embed = makeEmbed({
        author: {
          name: `Message sent by ${quote.member?.displayName ?? "Unknown Member"}`,
          iconURL: "https://wynem.com/assets/images/icons/quote.webp",
          url: `https://discord.com/channels/${quote.guildId}/${quote.channelId}/${quote.id}`
        },
        footer: {
          text: `Quoted by ${message.member.displayName}`,
          iconURL: message.member.displayAvatarURL({
            extension: Discord.ImageFormat.PNG
          })
        },
        thumbnail: quote.member.displayAvatarURL({
          extension: Discord.ImageFormat.PNG,
          size: 64
        }),
        timestamp: quote.createdTimestamp,
        description: quote.content
      })

      let image
        if (quote.attachments?.size) {
        const attachment = quote.attachments.first()
        if (attachment.contentType?.startsWith("image/")) {
          embed.setImage(attachment.url)
          image = true
        } else embed.addFields({
          name: "Attached file",
          value: `**[${attachment.name}](${attachment.url})**`
        })
      }
      if (!image && quote.content) {
        const url = quote.content.match(/https?:\/\/\S*?\.(png|jpe?g|gif|webp)/i)
        if (url) {
          embed.setImage(url[0].replace(/\s/g, ""))
        }
      }
      const tenorGifs = quote.embeds?.filter(e => e.data.provider.name === "Tenor" && e.data.thumbnail.url.match(tenorMatch)) ?? []
      if (!image && tenorGifs.length) {
        const m = tenorGifs[0].data.thumbnail.url.match(tenorMatch)
        embed.setImage(`https://c.tenor.com/${m[1]}C/tenor.gif`)
      }

      if (quote.stickers?.size) {
        embed.addFields({
          name: `${quote.stickers.size} Sticker${quote.stickers.size ? "" : "s"}`,
          value: quote.stickers.map(e => e.name).join(", ")
        })
      }

      const messageEmbeds = quote.embeds?.filter(e => !(["image", "video"].includes(e.data.type) || e.data.provider.name === "Tenor" && e.data.thumbnail.url.match(tenorMatch))) ?? []

      const additional = []
      if (messageEmbeds.length) {
        additional.push(`\`[${messageEmbeds.length} Embed${messageEmbeds.length === 1 ? "" : "s"}]\``)
      }
      if (quote.attachments?.size > 1) {
        additional.push(`\`[${quote.attachments.size - 1} Attachment${quote.attachments.size === 2 ? "" : "s"}]\``)
      }
      if (tenorGifs.length > 1) {
        additional.push(`\`[${tenorGifs.length - 1} Tenor Gif${tenorGifs.length === 2 ? "" : "s"}]\``)
      }
      if (additional.length) {
        embed.addFields({
          name: "Additional content",
          value: additional.join("\n")
        })
      }

      if (!embed.data.description && !embed.data.fields && !embed.data.image) continue

      if (countEmbedChars(embed)) break

      embeds.push(embed)
      done.add(id)
      if (embeds.length > 9) break

      for (const embed of messageEmbeds) {
        if (countEmbedChars(embed)) break
        embeds.push(embed)
        if (embeds.length > 9) break
      }
    }

    if (embeds.length) {
      const row = new Discord.ActionRowBuilder()

      const jump = new Discord.ButtonBuilder()
      jump.setLabel("Jump")
      jump.setURL(embeds[0].data.author.url)
      jump.setStyle(Discord.ButtonStyle.Link)

      const remove = new Discord.ButtonBuilder()
      remove.setEmoji(process.env.REMOVE_EMOJI)
      remove.setCustomId(`delete_${message.author.id}`)
      remove.setStyle(Discord.ButtonStyle.Danger)

      row.addComponents([jump, remove])

      message.reply({
        allowedMentions: {},
        embeds,
        components: [row]
      }).catch(() => {})
    }
  }
})

client.on("interactionCreate", interaction => {
  if (interaction.customId.startsWith("delete_")) {
    if (interaction.user.id === interaction.customId.slice(7) || ["ManageMessages", "ModerateMembers", "KickMembers", "BanMembers"].some(permission => interaction.member.permissions.has(Discord.PermissionsBitField.Flags[permission]))) {
      interaction.message.delete()
    } else {
      interaction.reply({
        content: "Only the message author can do that",
        ephemeral: true
      })
    }
  }
})

client.login(process.env.TOKEN)