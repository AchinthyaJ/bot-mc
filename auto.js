const mineflayer = require('mineflayer')

// Delay function for better timing control
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Create the bot
function createBot() {
  const bot = mineflayer.createBot({
    host: '37.187.133.17', // Your server IP
    port: 2748,          // Your server port
    username: 'camman18YT',     // Bot's username (can be any)
    version: false       // Auto-detect Minecraft version
  })

  let followPlayer = null
  let isAttacking = true
  let isHealing = false

  async function eatFood() {
    let food = bot.inventory.items().find(item => item.name.includes('beef') || item.name.includes('porkchop') || item.name.includes('bread'))
    if (food) {
      try {
        await bot.equip(food, 'hand')
        await bot.activateItem()
        console.log("Bot is eating to restore health.")
        await delay(3000) // Wait for eating animation
      } catch (err) {
        console.error("Failed to eat food:", err)
      }
    } else {
      bot.chat("I need food! Please drop some for me.")
    }
  }

  bot.on('entitySpawn', (entity) => {
    if (entity.objectType === 'item' && entity.metadata) {
      bot.collectBlock.collect(entity, (err) => {
        if (err) console.error("Failed to pick up item:", err)
        else console.log("Picked up food item!")
      })
    }
  })

  bot.once('spawn', async () => {
    console.log("Bot spawned at:", bot.entity.position)
    bot.chat("Hello, today I will be fighting the mobs, tell me if you'd like somthing else")

    async function findAndAttackMob() {
      if (!isAttacking || isHealing) return

      // Heal if health is low
      if (bot.health < 15) {
        isHealing = true
        while (bot.health < 20) {
          await eatFood()
          await delay(2000) // Wait before checking health again
        }
        isHealing = false
      }

      const mobs = Object.values(bot.entities).filter(entity => entity.type === 'mob')
      const target = mobs.sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position))[0]
      
      if (!target) {
        console.log("No mobs nearby.")
        return
      }
      async function equipSword() {
        const sword = bot.inventory.items().find(item => item.name.includes('stone_sword', 'netherite_sword'))
        if (sword) {
          try {
            await bot.equip(sword, 'hand')
            console.log("Equipped stone or netherite sword for combat.")
          } catch (err) {
            console.error("Failed to equip stone sword:", err)
          }
        } else {
          console.log("No stone sword found in inventory.")
        }
      }
      
      // Call this before attacking a mob
      await equipSword()
      bot.attack(target)

      bot.on('chat', async (username, message) => {
        if (message.toLowerCase() === 'pvp') {
          const player = bot.players[username]?.entity
          if (!player) {
            bot.chat("I can't see you!")
            return
          }
      
          bot.chat(`Engaging in PvP with ${username}!`)
      
          // Equip stone sword before attacking
          await equipSword()
      
          while (player && player.isValid) {
            bot.lookAt(player.position.offset(0, 1.6, 0)) // Look at player
      
            const distance = bot.entity.position.distanceTo(player.position)
            if (distance > 2) {
              bot.setControlState('forward', true) // Move towards player
            } else {
              bot.setControlState('forward', false) // Stop moving
              bot.attack(player) // Attack when close enough
            }
      
            await delay(500)
          }
          
          bot.setControlState('forward', false) // Stop moving when done
        }
      })
      
      console.log("Found a mob to attack:", target.name, "at", target.position)
      bot.chat(`Attacking ${target.name}!`)

      while (target && target.isValid && isAttacking && !isHealing) {
        const distance = bot.entity.position.distanceTo(target.position)
        bot.lookAt(target.position.offset(0, 1.6, 0)) // Look at the mob
        
        if (distance > 3) {
          bot.setControlState('forward', true)
          if (bot.entity.isInWater) {
            if (bot.entity.position.y < target.position.y) {
              bot.setControlState('jump', true) // Swim upwards
            } else {
              bot.setControlState('sprint', true) // Dive underwater
            }
          } else {
            bot.setControlState('jump', bot.entity.onGround) // Jump if needed
          }
        } else {
          bot.setControlState('forward', false)
          bot.setControlState('jump', false)
          bot.setControlState('sprint', bot.entity.isInWater && target.position.y < bot.entity.position.y) // Sneak only if diving
          bot.attack(target)
        }
        
        await delay(500)
      }
      bot.setControlState('forward', false) // Stop moving when done
      bot.setControlState('jump', false)
      bot.setControlState('sneak', false)
    }

    setInterval(findAndAttackMob, 5000)
  })
  
  let bedPosition = null // Store the bot's bed location

bot.on('chat', async (username, message) => {
  message = message.toLowerCase()

  if (message === 'set spawn' || message === 'bed') {
    const bed = bot.findBlock({
      matching: block => block.name.includes('bed'),
      maxDistance: 10
    })

    if (bed) {
      bedPosition = bed.position // Save bed location
      bot.chat("Setting spawn point...")
      await bot.lookAt(bed.position)
      await delay(500)
      bot.activateBlock(bed)
    } else {
      bot.chat("No bed nearby!")
    }
  }
})



// Check if it's night and sleep
async function sleepAtNight() {
  if (!bedPosition) return // No bed saved

  if (bot.time.isNight) {
    bot.chat("Me too!") // Respond to sleep request
    await bot.lookAt(bedPosition)
    await delay(500)

    const bedBlock = bot.blockAt(bedPosition)
    if (bedBlock && bedBlock.name.includes('bed')) {
      try {
        await bot.sleep(bedBlock)
        bot.chat("Good night!")
      } catch (err) {
        bot.chat("I can't sleep right now!")
      }
    }
  }
}

// Check every 10 seconds if the bot should sleep
setInterval(sleepAtNight, 10000)


  bot.on('chat', (username, message) => {
    if (message.toLowerCase() === 'follow') {
      followPlayer = username
      isAttacking = false
      bot.chat(`Following ${username}!`)
    } else if (message.toLowerCase() === 'stop') {
      followPlayer = null
      bot.chat("Stopped following.")
    } else if (message.toLowerCase() === 'attack') {
      isAttacking = true
      followPlayer = null
      bot.chat("Resuming attack mode!")
    }
  })

  bot.on('physicTick', () => {
    if (followPlayer) {
      const player = bot.players[followPlayer]?.entity
      if (player) {
        const distance = bot.entity.position.distanceTo(player.position)
        if (distance > 1) {
          bot.lookAt(player.position.offset(0, 1.6, 0))
          bot.setControlState('forward', true)
          if (bot.entity.isInWater) {
            bot.setControlState('jump', true)
          } else {
            bot.setControlState('jump', bot.entity.onGround)
          }
        } else {
          bot.setControlState('forward', false)
          bot.setControlState('jump', false)
        }
      } else {
        bot.setControlState('forward', false)
        bot.setControlState('jump', false)
      }
    }
  })

  bot.on('error', (err) => {
    console.error("Bot encountered an error:", err)
  })

  bot.on('end', () => {
    console.log("Bot disconnected.")
  })
}

createBot()