const _ = require('lodash')
const chalk = require('chalk').default

const quietMode = process.argv.findIndex(a => a.indexOf('-q') !== -1) !== -1

const AttackSeries = {
  /**
   * 饮血剑
   */
  TheBloodthirster: function () {
    this.MHP += 350 // 盾等价于增加350点最大生命，注意此处没有相应提高当前生命
    this.HSOH += 0.2
    this.BAP += 80
  },
  /**
   * 破败王者之刃
   */
  BladeOfTheRuinedKing: function () {
    this.AAH += 25
    this.BAP += 40
    this.HSOH += 0.12
    this.OAH.push(function (T) { // 每次攻击附带目标8%当前生命的物理伤害，且此伤害触发生命偷取
      const effect_buf = this.armorDamageOn(T, T.HP * 0.08)
      this.stealOnHit(effect_buf) // 偷取
      T.HP -= effect_buf
      if (!quietMode) console.log(chalk.magentaBright(`${this.NM} 破败 damage: ${effect_buf.toFixed(0)}`))
    })
  },
  /**
   * 卢安娜的飓风
   */
  HurricaneLuanna: function () {
    this.AAH += 40
    this.CR += 0.3
  },
  /**
   * 幻影之舞
   */
  PhantomDancer: function () {
    this.AAH += 45
    this.CR += 0.3
  },
  /**
   * 狂战士胫甲
   */
  BerserkersGreaves: function () {
    this.AAH += 35
  },
  /**
   * 多米尼克领主的致意
   */
  LordDominiksRegards: function () {
    this.APP = 1 - (1 - this.APP) * (1 - 0.35) // 百分比护穿乘法叠加，故添加新护穿时用1减，再乘以新1-护穿，再用1减
    this.BAP += 40
  },
  /**
   * 凡性的提醒
   */
  MortalReminder: function () {
    this.APP = 1 - (1 - this.APP) * (1 - 0.25)
    this.BAP += 40
    // 重伤
    this.OAH.push(_.once(function (T) {
      if (!T.DBUF.includes('DeepInjury')) {
        if (!quietMode) console.log(chalk.blueBright(this.NM + ' 凡性的提醒 重伤 on'))
        T.RHSCA.push(0.5)
        T.DBUF.push('DeepInjury')
      }
    }))
  },
  /**
   * 智慧末刃
   */
  WitsEnd: function () {
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
  /**
   * 黑色切割者
   */
  TheBlackCleaver: function () {
    this.BAP += 40
    this.MHP += 400
    this.HP += 400
    this.OAH.push(function (T) {
      if (this.CAT !== 0 && this.CAT < 5) {
        T.AR -= T.AR * 0.0625
      }
    })
  },
  /**
   * 无尽之刃
   */
  InfinityEdge: function () {
    this.CR = this.CR * 2
    this.BAP += 70
    this.OCHH.push(function (T, dmg) {
      const effectiveArmor = Math.max((1 - this.APP) * T.AR - this.APV, 0)
      const rawDMG = dmg / (this.DIT(T) * (1 - (effectiveArmor) / (100 + (effectiveArmor))) * (1 - T.DRP) * (1 - T.CHDRP))
      const reCalculatedDmgPhy = (rawDMG * 0.9) * (this.DIT(T) * (1 - (effectiveArmor) / (100 + (effectiveArmor))) * (1 - T.DRP) * (1 - T.CHDRP))
      const reCalculatedDmgReal = rawDMG * 0.1 * this.DIT(T)
      //console.log('重新计算', dmg, reCalculatedDmgPhy, reCalculatedDmgReal)
      this.TD += (reCalculatedDmgPhy + reCalculatedDmgReal) - dmg
      T.HP -= (reCalculatedDmgPhy + reCalculatedDmgReal) - dmg
      this.TDR += reCalculatedDmgReal
      this.TDP -= (reCalculatedDmgPhy - dmg)
      //console.log('this.TD 补偿', (reCalculatedDmgPhy + reCalculatedDmgReal) - dmg)
      //console.log('this.TDP 负补偿', (reCalculatedDmgPhy - dmg))
    })
  },
  /**
   * 鬼索的狂暴之刃
   */
  GuinsoosRageblade: function () {
    this.APP = 1 - (1 - this.APP) * (1 - 0.15) // 6+(0.5*level)%护甲穿透
    this.SPP = 1 - (1 - this.SPP) * (1 - 0.15) // 6+(0.5*level)%法术穿透
    this.BAP += 25
    this.BSP += 25
    this.AAH += 25
    const logState = _.once(function () {
      if (!quietMode) console.log(chalk.yellowBright('鬼索之怒 on'))
    })

    this.OAH.push(function Guinsoo(T) {
      const effect_buf = this.spellDamageOn(T, 15) // 每次攻击附带15魔法伤害
      T.HP -= effect_buf
      // 每次攻击+8%攻速 max 6层, 6层时鬼索之怒，特效x2
      if (this.CAT !== 0 && this.CAT < 7) {
        this.AAH += 8
      }
      if (this.CAT > 6) {
        logState()
        this.OAH.filter(fx => fx.name !== 'Guinsoo').forEach(fx => fx.call(this, T))
        const effect_buf = this.spellDamageOn(T, 15) // 每次攻击附带15魔法伤害
        T.HP -= effect_buf
      }
      if (!quietMode) console.log(chalk.magentaBright(`${this.NM} 鬼索的狂暴之刃 damage: ${effect_buf.toFixed(0)}`))
    })
  }
}

const DefenseSeries = {
  /**
   * 冰霜之心
   */
  FrozenHeart: function () {
    this.MMN += 400
    this.MN += 400
    this.AR += 100
    this.CDR += 20 // 20 -cd
    let lockDecreaseAH = false
    this.OADH.push(function (A) { // 降低15%攻速
      if (!lockDecreaseAH) {
        if (!A.DBUF.includes('FrozenIron')) {
          if (!quietMode) console.log(chalk.blueBright(this.NM + ' 冰霜之心 攻速 -15% on'))
          A.AHCR = A.AHCR * 0.85
          A.DBUF.push('FrozenIron')
        }
        lockDecreaseAH = true
      }
    })
  },
  /**
   * 荆棘之甲
   */
  Thornmail: function () {
    this.MHP += 250
    this.HP += 250
    this.AR += 80
    this.OADH.push(function (A) { // 反伤
      const effect_buf = this.spellDamageOn(A, this.AR * 0.1 + 25)
      A.HP -= effect_buf
      if (!quietMode) console.log(chalk.cyanBright(`${this.NM} 荆棘之甲 damage: ${effect_buf.toFixed(0)}`))
    })
    this.OADH.push(_.once(function (A) {// 重伤
      if (!A.DBUF.includes('DeepInjury')) {
        A.RHSCA.push(0.5)
        A.DBUF.push('DeepInjury')
      }
    }))
  },
  /**
   * 日炎斗篷
   */
  SunfireCape: function () {
    this.MHP += 425
    this.HP += 425
    this.AR += 60
    if (this.NSH.findIndex(fx => fx.name === 'sunfirecape') === -1) {
      this.NSH.push(function sunfirecape(T) {
        const effect_buf = this.spellDamageOn(T, 43)
        T.HP -= effect_buf
        if (!quietMode) console.log(chalk.cyanBright(`${this.NM} 日炎斗篷 damage: ${effect_buf.toFixed(0)}`))
      })
    }
  },
  /**
   * 兰顿之兆
   */
  RanduinsOmen: function () {
    this.MHP += 400
    this.HP += 400
    this.AR += 60
    this.CHDRP += 0.2
    let lockDecreaseAH = false
    this.OADH.push(function (A) { // 降低15%攻速
      if (!lockDecreaseAH) {
        if (!A.DBUF.includes('FrozenIron')) {
          if (!quietMode) console.log(chalk.blueBright(this.NM + ' 兰顿之兆 攻速 -15% on'))
          A.AHCR = A.AHCR * 0.85
          A.DBUF.push('FrozenIron')
        }
        lockDecreaseAH = true
      }
    })
  },
  /**
   * 石像鬼石板甲
   */
  GargoyleSlate: function () {
    this.AR += 80
    this.MR += 80
  },
  /**
   * 亡者的板甲
   */
  DeadMansPlate: function () {
    this.MHP += 425
    this.HP += 425
    this.AR += 60
  },
  /**
   * 阿塔玛的清算
   */
  AtamasLiquidation: function () {
    this.BAP += 25
    this.AR += 30
    this.MR += 30
    if (this.NSH.findIndex(fx => fx.name === 'atamasliquidation') === -1) {
      this.NSH.push(function atamasliquidation(T, sec) { // 每秒+0.5%最大生命的攻击，最大2.5%
        if (sec < 5) {
          this.BAP += this.MHP * 0.005
        }
      })
    }
  },
  /**
   * 自然之力
   */
  ForceOfNature: function () {
    this.MR += 90
    this.HRC += 200
    if (this.NSH.findIndex(fx => fx.name === 'forceofnature') === -1) {
      this.NSH.push(function forceofnature() { // 每秒回复1.5%最大生命
        if (!quietMode) console.log(chalk.greenBright(this.NM + ' 自然之力 回复 ' + Math.min(0.015 * this.MHP, this.MHP - this.HP)))
        this.HP += 0.015 * this.MHP
        this.TR += Math.min(0.015 * this.MHP, this.MHP - this.HP)
      })
    }
  },
  /**
   * 狂徒铠甲
   */
  WarmogsArmor: function () {
    this.MHP += 800
    this.HP += 800
    this.HRC += 200
    this.CDR += 10
    if (this.NSH.findIndex(fx => fx.name === 'warmogsarmor') === -1) {
      this.NSH.push(function warmogsarmor() { // 每秒回复5%最大生命
        if (this.MHP > 3000) {
          if (!quietMode) console.log(chalk.greenBright(this.NM + ' 狂徒铠甲 回复 ' + Math.min(0.05 * this.MHP, this.MHP - this.HP)))
          this.HP += 0.05 * this.MHP
          this.TR += Math.min(0.05 * this.MHP, this.MHP - this.HP)
        }
      })
    }
  },
  /**
   * 霸王血铠
   */
  OverlordBloodArmor: function () {
    this.MHP += 800
    this.HP += 800
    this.HRC += 100
    this.BHR += 60
  },
  /**
   * 振奋铠甲
   */
  SpiritVisage: function () {
    this.MHP += 450
    this.HP += 450
    this.MR += 55
    this.HRC += 100
    this.CDR += 10
    this.RHSCA.push(1.3)
  }
}

const synthetical = {
  /**
   * 坚忍之属性手杖 10000 ver.
   */
  ThePropertyStoicCane: function () {
    this.MHP += 1000
    this.HP += 1000
    this.HRC += 500
    this.MNRC += 500
    this.AR += 150
    this.MR += 150
    this.BAP += 250
    this.BSP += 500
    this.AAH += 200
    this.CR += 1
    this.HSOH += 0.4
    this.CDR += 40
  }
}

const special = {
  Ashe_Q: function (H) { // 寒冰 Q
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
    const rangersFocusHasteEnhance = 40
    const rangersFocusAPEnhance = 2.25
    this.OAH.push(function (T) {
      if (!rangersFocus.fired) {
        rangersFocus.prepareStackCount++
        if (
          (H.ticks - rangersFocus.lastTriggerTick > 35 * H._tick || rangersFocus.lastTriggerTick === -1) && // cd has recovered
          rangersFocus.prepareStackCount === 4
        ) { // ready to trigger Q
          if (!quietMode) console.log(chalk.yellowBright(this.NM + ' 射手的专注 on'))
          this.APMR = this.APMR * rangersFocusAPEnhance
          this.AAH += rangersFocusHasteEnhance
          rangersFocus.prepareStackCount = 0
          rangersFocus.fired = true
          rangersFocus.lastTriggerTick = H.ticks
        }
      }
      else {
        if (H.ticks - rangersFocus.lastTriggerTick >= 5 * H._tick) { // duration had exceeded
          if (!quietMode) console.log(chalk.yellow(this.NM + ' 射手的专注 off'))
          rangersFocus.fired = false
          this.APMR = this.APMR / rangersFocusAPEnhance
          this.AAH -= rangersFocusHasteEnhance
        }
      }
    })
  },
  ShaunaVayne_W: function () { // VN W技能被动
    // 对同一目标每攻击或施法2次，第3次攻击或施法就会造成目标 14% 最大生命值的真实伤害
    // 对所有目标的最小伤害: 110
    let icount = 1
    this.OAH.push(function (T) {
      if (icount++ % 3 === 0) {
        const dmg = Math.max(this.realDamageOn(T, T.MHP * 0.14), 110)
        T.HP -= dmg
        if (!quietMode) console.log(chalk.redBright(`${this.NM} 圣银弩箭 damage ${dmg.toFixed(0)}`))
      }
    })
  },
  Gnar_W: function () { // 纳尔 W
    // 对相同目标的每第三次攻击或施法，都会造成额外的50(+100% 法术强度)+目标最大生命值的14%的魔法伤害
    let icount = 1
    this.OAH.push(function (T) {
      if (icount++ % 3 === 0) {
        const dmg = this.spellDamageOn(T, T.MHP * 0.14 + 50 + 1.0 * this.SP)
        T.HP -= dmg
        if (!quietMode) console.log(chalk.magentaBright(`${this.NM} 亢奋 damage ${dmg.toFixed(0)}`))
      }
    })
  }
}

const Custom = {
  custom_1_adc: function () {
    this.OAH.push(function () {
      this.APP = 1 - (1 - this.APP) * (1 - 0.01)
      // this.AAH += 110
    })
  }
}

module.exports = {
  AttackSeries,
  DefenseSeries,
  synthetical,
  special,
  Custom
}
