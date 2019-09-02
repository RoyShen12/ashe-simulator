const chalk = require('chalk').default

const Hero = require('./Hero')
const equip = require('./equipments')

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
  criticalDamagePercent: 3.000, // 暴击伤害
  onAttackingHook: function () {
    let icount = 1
    return function (T) {
      // buffer, +xx ap/hit, max 6, dur 5s
      if (icount++ !== 0 && icount++ < 7) {
        this.BAP += 45
      }
      // buffer, +xx% aah/hit, max 10, dur 6s
      if (icount++ !== 0 && icount++ < 11) {
        this.AAH += 12
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
    equip.Custom.custom_1_adc,
    // equip.special.ShaunaVayne_W,
    equip.special.Gnar_W,
    equip.special.Ashe_Q,
    equip.AttackSeries.BladeOfTheRuinedKing,
    equip.AttackSeries.BerserkersGreaves,
    equip.AttackSeries.GuinsoosRageblade,
    equip.AttackSeries.HurricaneLuanna,
    equip.AttackSeries.LordDominiksRegards,
    equip.AttackSeries.MortalReminder,
    equip.AttackSeries.PhantomDancer,
    equip.AttackSeries.TheBlackCleaver,
    equip.AttackSeries.TheBloodthirster,
    equip.AttackSeries.WitsEnd,
    equip.synthetical.ThePropertyStoicCane,
    equip.AttackSeries.InfinityEdge
  ]
})

// ----------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------

const t = new Hero({
  name: '木桩',
  maxHealth: 100000,
  attackPower: 134,
  baseAttackHaste: 0.638,
  alternativeAttackHaste: 3.4 * 18 + 15,
  armorPenetrationPercent: 1 - (1 - 0.06), // 天赋-6%
  armorPenetrationValue: 9, // 天赋-9
  spellPenetrationPercent: 1 - (1 - 0.06), // 天赋-6%
  spellPenetrationValue: 0,
  onAttackingHook: function (T) {
  },
  healthRegeneration: 16.9, // 每秒回复
  armor: 124.5,
  magicResistance: 74.5,
  baseDamageResistancePercent: 0.05, // 抵抗5%伤害
  criticalHitDamageResistancePercent: 0.05, // 抵抗5%暴击伤害
  criticalHitChangeDecrease: 0.05,　// 降低5%被暴击几率
  onAttackedHook: function () {
    let lastParryTriggersTick = -1
    let parryCountOneTurn = 0
    return function (A, DMG) {

      // 木桩每次受攻击增加护甲和魔抗
      this.AR += 8
      this.MR += 8

      // 每失去 x% 生命值就增加 y% 伤害抵抗
      this.ADRP = (this.MHP - this.HP) / this.MHP / 3
      // console.log(`${this.NM} damage resistence now ${this.ADRP}`)
      // 天赋，骸骨镀层，每45s抵挡3次伤害50点
      if (Hero.ticks - lastParryTriggersTick > 45 * Hero._tick || lastParryTriggersTick === -1) {
        if (parryCountOneTurn >= 3) {
          lastParryTriggersTick = Hero.ticks
          parryCountOneTurn = 0
        }
        else {
          if (!quietMode) console.log(chalk.blueBright(`${this.NM} 格挡 50 damage`))
          this.HP += Math.min(50, DMG)
          parryCountOneTurn++
        }
      }
      // 复苏之风，10秒内恢复损失的生命值的(4%+6)点
      this.HR = ((this.MHP - this.HP) * 0.04 + 6) / 10
      if (!quietMode) console.log(chalk.greenBright(`${this.NM} 复苏之风 HR: ${this.HR.toFixed(2)}/s, total: ${(this.HRPT * Hero._tick).toFixed(2)}/s`))
    }
  }(),
  equipments: [
    equip.DefenseSeries.Thornmail,
    equip.DefenseSeries.SunfireCape,
    equip.DefenseSeries.FrozenHeart,
    equip.DefenseSeries.GargoyleSlate,
    equip.DefenseSeries.DeadMansPlate,
    equip.DefenseSeries.RanduinsOmen,
    equip.DefenseSeries.AtamasLiquidation,
    equip.DefenseSeries.ForceOfNature,
    equip.DefenseSeries.WarmogsArmor,
    equip.DefenseSeries.OverlordBloodArmor,
    equip.DefenseSeries.SpiritVisage
  ]
})

console.log(`${Hero._tick} ticks per second\n`)

p.print()
t.print()
// console.log(p, t)

// ----------------------------------------- simulator start --------------------------------------------

while (t.HP > 0 && p.HP > 0) {
  // new second hook
  if ((Hero.ticks + 1) % Hero._tick === 1) {
    const second = parseInt(Hero.ticks / Hero._tick)
    if (!quietMode) console.log(`\n\n---------------  ${second} s  ---------------\n\n`)
    t.NSH.forEach(fx => fx.call(t, p, second))
    p.NSH.forEach(fx => fx.call(p, t, second))
  }
  // 每刻都自然恢复生命
  if (t.HP < t.MHP) {
    t.HP += t.HRPT * t.RHSC
    t.TR += Math.min(t.HRPT * t.RHSC, t.MHP - t.HP)
  }
  if (p.HP < p.MHP) {
    p.HP += p.HRPT * p.RHSC
    p.TR += Math.min(p.HRPT * p.RHSC, p.MHP - p.HP)
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
