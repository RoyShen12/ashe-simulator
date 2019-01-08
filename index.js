const chalk = require('chalk').default

const Hero = require('./Hero')

const quietMode = process.argv.findIndex(a => a.indexOf('-q') !== -1) !== -1

const p = new Hero({
  name: '寒冰',
  maxHealth: 1950,
  attackPower: 97, // 攻击力
  healthStealingOnHit: 0.08, // 生命偷取 天赋-8%
  baseAttackHaste: 0.658, // 基础攻速 面板标准格式
  alternativeAttackHaste: 18 * 3.3 + 6, // 额外攻速 百分比格式 3.3%/级 天赋-6%
  armorPenetrationPercent: 1 - (1 - 0.06), // 百分比护甲穿透 乘积格式 多个穿甲效果叠加=1-(1-p1)*(1-p2) 天赋-6%
  armorPenetrationValue: 9, // 固定穿甲 天赋-9
  spellPenetrationPercent: 1 - (1 - 0.06), // 百分比法术穿透 计算同护甲 天赋-6%
  spellPenetrationValue: 0, // 固定法穿
  critRate: 0, // 暴击率 格式 0.x 超过100%效果为100%
  criticalDamagePercent: 2.000, // 暴击伤害
  onAttackingHook: function () {
    let __prepare_stack_count = 0
    const rangersFocus = { // 寒冰Q 状态
      fired: false, // Q 触发中
      get prepareStackCount() { // Q 层数
        return __prepare_stack_count
      },
      set prepareStackCount(v) {
        __prepare_stack_count = Math.min(v, 4)
      },
      lastTriggerTick: -1 // 上次使用Q的tick
    }
    return function (T) {
      // buffer, +5 ap/hit, max 6, dur 5s
      if (this.CAT !== 0 && this.CAT < 7) {
        this.BAP += 5
      }
      // buffer, +6% aah/hit, max 10, dur 6s
      if (this.CAT !== 0 && this.CAT < 11) {
        this.AAH += 12
      }
      // skill Q, +110% aah/+1.25*AP dmg, trigger after 4 hits, dur 5s, cd 35s
      const rangersFocusHasteEnhance = 110
      const rangersFocusAPEnhance = 2.25
      if (!rangersFocus.fired) {
        rangersFocus.prepareStackCount++
        if (
          (Hero.ticks - rangersFocus.lastTriggerTick > 35 * Hero._tick || rangersFocus.lastTriggerTick === -1) && // cd has recovered
          rangersFocus.prepareStackCount === 4
        ) { // ready to trigger Q
          if (!quietMode) console.log(chalk.yellowBright('射手的专注 on'))
          this.APMR = this.APMR * rangersFocusAPEnhance
          this.AAH += rangersFocusHasteEnhance
          rangersFocus.prepareStackCount = 0
          rangersFocus.fired = true
          rangersFocus.lastTriggerTick = Hero.ticks
        }
      }
      else {
        if (Hero.ticks - rangersFocus.lastTriggerTick >= 5 * Hero._tick) { // duration had exceeded
          if (!quietMode) console.log(chalk.yellow('射手的专注 off'))
          rangersFocus.fired = false
          this.APMR = this.APMR / rangersFocusAPEnhance
          this.AAH -= rangersFocusHasteEnhance
        }
      }
    }
  }(),
  healthRegeneration: 5.7, // 每秒回复
  armor: 79, // 护甲
  magicResistance: 39, // 魔抗
  damageIncreasementTalent: function (T) { // 伤害最终计算系数 （对真实伤害无效）
    const rate = []
    if (T) {
      if ((T.HP / T.MHP) < 0.4) rate.push(1.07) // 目标生命<40%，伤害+4%
      if (T.MHP - this.HP > 150) rate.push(1 + (Math.min(((T.MHP - this.HP) - 150) / 1850, 1) * 0.06 + 0.04)) // 符文-砍倒
    }
    //console.log('${this.NM} damage amplifying: ', rate)
    return rate.reduce((pv, cv) => pv * cv, 1)
  },
  equipments: [
    function () { // 饮血剑
      this.MHP += 350 // 盾等价于增加350点最大生命，注意此处没有相应提高当前生命
      this.HSOH += 0.2
      this.BAP += 80
    },
    function () { // 破败
      this.AAH += 25
      this.BAP += 40
      this.HSOH += 0.12
      this.OAH.push(function (T) { // 每次攻击附带目标8%当前什么的物理伤害，且此伤害触发生命偷取
        const effect_buf = this.armorDamageOn(T, T.HP * 0.08)
        const stolenHP_buf = Math.min(this.HSOH * effect_buf, this.MHP - this.HP)
        T.HP -= effect_buf
        this.HP += stolenHP_buf // heal by hp stealing
        this.TS += stolenHP_buf // statistic
        if (!quietMode) console.log(chalk.magentaBright(`${this.NM} 破败 damage: ${effect_buf.toFixed(0)}`))
      })
    },
    function () { // 飓风+绿叉+攻速鞋
      this.AAH += (45 + 40 + 35)
      this.CR += 0.6
    },
    function () { // 多米尼克领主的致意
      this.APP = 1 - (1 - this.APP) * (1 - 0.35) // 百分比护穿乘法叠加，故添加新护穿时用1减，再乘以新1-护穿，再用1减
      this.BAP += 40
    },
    function () { // 智慧末刃
      this.AAH += 40
      this.MR += 40
      this.OAH.push(function (T) {
        if (this.CAT === 1) { // 首次攻击偷取30魔抗
          T.MR -= 30
        }
        const effect_buf = this.spellDamageOn(T, 42) // 每次攻击附带42魔法伤害
        T.HP -= effect_buf
        if (!quietMode) console.log(chalk.magentaBright(`${this.NM} 智慧末刃 damage: ${effect_buf.toFixed(0)}`))
      })
    },
    function () { // 黑切
      this.BAP += 40
      this.MHP += 400
      this.HP += 400
      this.OAH.push(function (T) {
        if (this.CAT !== 0 && this.CAT < 5) {
          T.AR -= T.AR * 0.0625
        }
      })
    },
    function () { // 无尽
      this.CR = this.CR * 2
      this.BAP += 70
      this.OCHH.push(function (T, dmg) {
        const rawDMG = dmg / (this.DIT(T) * (1 - ((1 - this.APP) * T.AR - this.APV) / (100 + ((1 - this.APP) * T.AR - this.APV))) * (1 - T.DRP) * (1 - T.CHDRP))
        const reCalculatedDmgPhy = (rawDMG * 0.9) * (this.DIT(T) * (1 - ((1 - this.APP) * T.AR - this.APV) / (100 + ((1 - this.APP) * T.AR - this.APV))) * (1 - T.DRP) * (1 - T.CHDRP))
        const reCalculatedDmgReal = rawDMG * 0.1
        //console.log('重新计算', dmg, reCalculatedDmgPhy, reCalculatedDmgReal)
        this.TD += (reCalculatedDmgPhy + reCalculatedDmgReal) - dmg
        T.HP -= (reCalculatedDmgPhy + reCalculatedDmgReal) - dmg
        this.TDR += reCalculatedDmgReal
        this.TDP -= (reCalculatedDmgPhy - dmg)
        //console.log('this.TD 补偿', (reCalculatedDmgPhy + reCalculatedDmgReal) - dmg)
        //console.log('this.TDP 负补偿', (reCalculatedDmgPhy - dmg))
      })
    },
    function () { // VN W 被动插件
      // 对同一目标每攻击或施法2次，第3次攻击或施法就会造成目标 14% 最大生命值的真实伤害
      // 对所有目标的最小伤害: 110
      this.OAH.push(function (T) {
        if (this.CAT % 3 === 0) {
          const dmg = Math.max(this.realDamageOn(T, T.MHP * 0.14), 110)
          T.HP -= dmg
          console.log(chalk.redBright(`${this.NM} 圣银弩箭 damage ${dmg.toFixed(0)}`))
        }
      })
    }
  ]
})

// ----------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------

const t = new Hero({
  name: '木桩',
  maxHealth: 500000,
  attackPower: 400,
  baseAttackHaste: 0.620,
  alternativeAttackHaste: 2.1 * 18,
  armorPenetrationPercent: 1 - (1 - 0.06), // 天赋-6%
  armorPenetrationValue: 64, // 幽梦-18 天赋-9 幕刃-18 ...
  spellPenetrationPercent: 1 - (1 - 0.06), // 天赋-6%
  spellPenetrationValue: 0,
  onAttackingHook: function (T) {
    // 幕刃，320伤害
    if (this.CAT === 1) {
      const effect_buf = this.armorDamageOn(T, 320)
      T.HP -= effect_buf
      if (!quietMode) console.log(`${this.NM} 幕刃 damage: ${effect_buf.toFixed(1)}`)
    }
  },
  healthRegeneration: 200, // 木桩每秒回复200
  armor: 320,
  magicResistance: 330,
  baseDamageResistancePercent: 0.05, // 木桩抵抗5%伤害
  criticalHitDamageResistancePercent: 0.1, // 木桩抵抗5%暴击伤害
  criticalHitChangeDecrease: 0.05,　// 木桩降低5%被暴击几率
  onAttackedHook: function () {
    let lockDecreaseAH = false
    let lastParryTriggersTick = -1
    let parryCountOneTurn = 0
    return function (attacker) {
      // 木桩每次受攻击增加1护甲和魔抗
      this.AR += 1
      this.MR += 1

      // 每失去8%生命值就增加1%伤害抵抗
      this.ADRP = (this.MHP - this.HP) / this.MHP / 8
      // console.log(`${this.NM} damage resistence now ${this.ADRP}`)
      // 冰霜之心，降低15%攻速
      if (!lockDecreaseAH) {
        attacker.AHCR = attacker.AHCR * 0.85
        lockDecreaseAH = true
      }
      // 天赋，骸骨镀层，每45s抵挡3次伤害50点
      if (Hero.ticks - lastParryTriggersTick > 45 * Hero._tick || lastParryTriggersTick === -1) {
        if (parryCountOneTurn >= 3) {
          lastParryTriggersTick = Hero.ticks
          parryCountOneTurn = 0
        }
        else {
          if (!quietMode) console.log(chalk.blueBright(`${this.NM} 格挡 50 damage`))
          this.HP += 50
          parryCountOneTurn++
        }
      }
      // 复苏之风，10秒内恢复损失的生命值的(4%+6)点
      this.HR = ((this.MHP - this.HP) * 0.04 + 6) / 10
      if (!quietMode) console.log(chalk.greenBright(`${this.NM} 复苏之风 HR: ${this.HR.toFixed(2)}/s total HR: ${(this.HRPT * Hero._tick).toFixed(2)}/s`))
    }
  }()
})

console.log(`${Hero._tick} ticks per second\n`)

p.print()
t.print()

// ----------------------------------------- simulator start --------------------------------------------

while (t.HP > 0 && p.HP > 0) {
  // 每刻都自然恢复生命
  if (t.HP < t.MHP) {
    t.HP += t.HRPT
    t.TR += Math.min(t.HRPT, t.MHP - t.HP)
  }
  if (p.HP < p.MHP) {
    p.HP += p.HRPT
    p.TR += Math.min(p.HRPT, p.MHP - p.HP)
  }
  // 如果可以攻击，就攻击
  if (p.TSH) {
    if (!quietMode) console.log(`\n${p.NM} round ${Hero.ticks / Hero._tick} s`)
    p.attack(t)
  }
  if (t.TSH) {
    if (!quietMode) console.log(`\n${t.NM} round ${Hero.ticks / Hero._tick} s`)
    t.attack(p)
  }
  // 时间流逝
  Hero.ticks++
  // Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10) // 休息10ms每tick
}

console.log(`\n战斗时间 ${(Hero.ticks / Hero._tick).toFixed(1)} s`)
console.log(`\n    ${t.HP > p.HP ? t.NM : p.NM} win\n`)

p.print()
t.print()
