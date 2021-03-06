const chalk = require('chalk').default

const tool = require('./tools')

const quietMode = process.argv.findIndex(a => a.indexOf('-q') !== -1) !== -1

const hero_option = {
  name: '',
  attackPower: 95, // 攻击力
  spellPower: 0, // 法术强度
  coolingDownReduction: 0, // 冷却缩减 10 means 10%
  maxCoolingDownReduction: 40, // 冷却缩减上限
  healthStealingOnHit: 0, // self healing by percentage of each hit's actual damage 生命偷取
  healthStealingOnSpell: 0, // self healing by percentage of each spell's actual damage 法术吸血
  healthRecoverageOnDamaging: 0, // self healing by percentage of every actual damage (damage of AOE will benifit 33% of this effect) 造成伤害自我治疗比例
  baseAttackHaste: 0.658, // times of attack per second
  alternativeAttackHaste: 2 * 18, // percentage of attack haste enhancement
  armorPenetrationPercent: 1 - (1 - 0.06), // coefficient of target's armor penetration
  armorPenetrationValue: 5, // value of target's armor to ignore
  spellPenetrationPercent: 1 - (1 - 0.06), // coefficient of target's spell resistance penetration
  spellPenetrationValue: 4, // value of target's spell resistance to ignore
  critRate: 0,
  criticalDamagePercent: 2,
  onAttackingHook: new Function(), // 攻击时钩子
  onCriticalHittingHook: new Function(), // 暴击时的钩子
  maxHealth: 1871,
  maxMana: 960,
  healthRegeneration: 5.3, // health regenerates per second
  namaRegeneration: 9.0, // mana regenerates per second
  armor: 79,
  magicResistance: 39,
  baseDamageResistancePercent: 0, // 伤害减免百分比
  criticalHitDamageResistancePercentRate: 0, // 暴击伤害减免百分比
  criticalHitChangeDecrease: 0, // 被暴击几率降低百分比
  onAttackedHook: new Function(), // 受攻击时钩子
  onCriticalHittedHook: new Function(), // 受暴击时钩子
  damageIncreasementTalent: () => 1, // 伤害最终计算系数，默认总为1
  // 装备列表
  // 是一个若干函数组成的数组，每个函数都会在构造函数中被调用，其中this指向此英雄
  // 如果装备增加了50点攻击力，则函数中语句为：
  // this.BAP += 50
  // 更复杂的情况是装备具有特殊的特效
  // 如果装备会在攻击时削弱目标的护甲5点，叠加6层，那么函数中的语句为：
  // this.OAH.push(function (T) { // 向OAH（攻击时触发钩子）中添加钩子函数，函数参数T即为目标
  //   if(this.CAT !== 0 && this.CAT < 7) { // 如果当前是第1-6次攻击，那么叠加层数
  //     T.AR -= 5 // 削弱目标的护甲 by 5
  //   }
  // })
  equipments: []
}

class Hero {
  constructor(option) {
    tool.conservativeAssignment(option, Hero.HeroOption, false)
    this.NM = option.name
    // debuff list 负面效果 （防冲突）
    this.DBUF = []
    // resource
    this.MMN = option.maxMana // x -- todo
    this.MN = option.maxMana // x -- todo
    // def
    this.HR = 0 // HealthRegeneration 额外每秒回复
    this.MNR = 0 // Mana Regeneration 额外法力每秒回复 x -- todo
    this.RHSCA = [1] // Recovering/Healing/StealingCoefficientArray 治疗、回复、吸血、生命偷取缩放系数 多个值
    this.ADRP = 0 // AlternativeDamageResistancePercent 减伤缩放系数
    this.TR = 0 // Total Recover 总回复
    this.MHP = option.maxHealth
    this.__HP = option.maxHealth // #private
    this.BHR = option.healthRegeneration // 基础回复(每秒)
    this.BMNR = option.namaRegeneration // 基础法力回复(每秒) x -- todo
    this.HRC = 100 // 基础回复的缩放系数（装备加成用） 10 means 10%
    this.MNRC = 100 // 基础法力回复的缩放系数（装备加成用） 10 means 10% x -- todo
    this.AR = option.armor
    this.MR = option.magicResistance
    this.BDRP = option.baseDamageResistancePercent
    this.CHDRP = option.criticalHitDamageResistancePercentRate
    this.CHCD = option.criticalHitChangeDecrease
    this.OADH = [option.onAttackedHook]
    this.OCHDH = [option.onCriticalHittedHook]
    // atk
    this.CAT = 0 // Continuous AttackTimes 总攻击次数
    this.LHT = -1 // Last Hit Tick 上次攻击时的tick（时刻）
    this.AHCR = 1 // Attack Haste Calculate Rate
    this.APMR = 1 // Attack Power Magnifier Rate
    this.SPMR = 1 // Spell Power Magnifier Rate
    this.TD = 0 // Total Damage
    this.TDP = 0 // Total Damage Physics
    this.TDM = 0 // Total Damage Magic
    this.TDR = 0 // Total Damage Real
    this.TS = 0 // Total Stealing
    this.BAP = option.attackPower
    this.BSP = option.spellPower
    this.CDR = option.coolingDownReduction // 10 means 10% x -- todo
    this.MCDR = option.maxCoolingDownReduction // 10 means 10% x -- todo
    this.HSOH = option.healthStealingOnHit
    this.HSOS = option.healthStealingOnSpell
    this.HROD = option.healthRecoverageOnDamaging // x -- todo
    this.BAH = option.baseAttackHaste
    this.AAH = option.alternativeAttackHaste
    this.APP = option.armorPenetrationPercent
    this.APV = option.armorPenetrationValue
    this.SPP = option.spellPenetrationPercent
    this.SPV = option.spellPenetrationValue
    this.CR = option.critRate // 0.1 means 10% crit rate
    this.CDP = option.criticalDamagePercent
    this.OAH = [option.onAttackingHook]
    this.OCHH = [option.onCriticalHittingHook]
    // talent
    this.DIT = option.damageIncreasementTalent
    // new second hook 每秒钩子
    this.NSH = []
    // 应用装备
    try {
      option.equipments.forEach(EQP => {
        EQP.call(this, Hero)
      })
    } catch (error) {
      console.error(error)
      process.exit(0)
    }
  }
  get HP() {
    return this.__HP
  }
  set HP(v) { // 防止生命值因为回复、吸血超出上限
    this.__HP = Math.max(Math.min(v, this.MHP), 0)
  }
  get HRPT() { // Health Regeneration Per Tick 每tick（刻）的生命回复
    return (this.BHR * (this.HRC / 100) + this.HR) / Hero._tick
  }
  get RHSC() { // Recovering/Healing/Stealing Coefficient 治疗、回复、吸血、生命偷取缩放系数 计算值
    return this.RHSCA.reduce((pv, cv) => pv * cv, 1)
  }
  get MNRPT() { // Mana Regeneration Per Tick 每tick（刻）的法力回复
    return (this.BMNR * (this.MNRC / 100) + this.MNR) / Hero._tick
  }
  get DRP() { // DamageResistencePercentage 总的伤害抵抗百分比
    return 1 - (1 - this.BDRP) * (1 - this.ADRP)
  }
  get AP() { // Attack Power 总的攻击值 = 攻击 * 攻击缩放系数
    return this.BAP * this.APMR
  }
  get SP() { // Spell Power 总法强 = 法强 * 法强缩放系数
    return this.BSP * this.SPMR
  }
  get RCDC() { // Real Cooling Down Coefficient 冷却时间缩放比例
    return 1 - Math.min(this.CDR, this.MCDR) / 100
  }
  get AH() { // Attack Haste 攻速 = 基础攻速 * 额外攻速 * 攻速缩放系数（攻速缩放系数 作用是方便计算目标的冰心等装备）
    return this.BAH * (1 + this.AAH / 100) * this.AHCR
  }
  get TPH() { // Ticks Per Hit 每两次攻击的tick间隔
    return Hero._tick / this.AH
  }
  get TSH() { // this Tick Should Hit 英雄本tick是否应该攻击
    return Hero.ticks - this.LHT >= this.TPH
  }
  /**
   * 计算、结算、统计实际普通攻击伤害带来的生命偷取效果
   * @param {number} actualDMG 
   */
  stealOnHit(actualDMG) {
    const shouldStolenHP = this.HSOH/*吸血率*/ * this.RHSC/*系数（重伤等）*/ * actualDMG
    const stolenHP = Math.min(shouldStolenHP, this.MHP - this.HP/*不超过最大生命*/)
    this.HP += stolenHP // 结算
    this.TS += stolenHP // 统计
    return [shouldStolenHP, stolenHP]
  }
  /**
   * 计算、结算、统计实际法术伤害带来的法术吸血效果
   * @param {number} actualDMG 
   */
  stealOnSpell(actualDMG) {
    const stolenHP = Math.min(this.HSOS/*吸血率*/ * this.RHSC/*系数（重伤等）*/ * actualDMG, this.MHP - this.HP/*不超过最大生命*/)
    this.HP += stolenHP // 结算
    this.TS += stolenHP // 统计
  }
  /**
   * 计算实际物理伤害，各种形式的伤害都交给此函数计算实际值
   * 自动统计到总伤害
   * ** 不一定是普通攻击，需要手动计算生命偷取
   * @param {Hero} T
   */
  armorDamageOn(T, DMG, isCrit = false) {
    // isCrit ? console.log('p1', DMG * this.CDP) : void 0
    //console.log(`${this.NM} armor damageOn raw dmg: ${DMG.toFixed(1)}`)
    const effectiveArmor = Math.max((1 - this.APP) * T.AR - this.APV, 0)
    // console.log(`${this.NM} 目标护甲 -> 有效护甲: ${T.AR} -> ${effectiveArmor.toFixed(1)}`)
    // console.log(`${this.NM} 等效穿甲率 ${((1 - effectiveArmor / T.AR) * 100).toFixed(2)} %`)
    const coefficient = (1 - effectiveArmor / (100 + effectiveArmor)) * (1 - T.DRP) * (isCrit ? (1 - T.CHDRP) : 1)
    //console.log(`${this.NM} only armor coefficient: ${(1 - effectiveArmor / (100 + effectiveArmor)).toFixed(3)}, coefficient: ${coefficient.toFixed(3)}`)
    const realDMG = (isCrit ? 1 * this.CDP : 1) * DMG
    const atd = coefficient * realDMG * this.DIT(T)
    this.TD += atd
    this.TDP += atd
    return atd
  }
  /**
   * 计算实际魔法伤害
   * @param {Hero} T
   */
  spellDamageOn(T, DMG) {
    //console.log(`${this.NM} spellDamageOn raw dmg: ${DMG.toFixed(1)}`)
    const effectiveMR = Math.max((1 - this.SPP) * T.MR - this.SPV, -10)
    // console.log(`${this.NM} 目标魔抗 -> 有效魔抗: ${T.MR} -> ${effectiveMR.toFixed(1)}`)
    // console.log(`${this.NM} 等效法穿率 ${((1 - effectiveMR / T.MR) * 100).toFixed(2)} %`)
    const coefficient = (1 - effectiveMR / (100 + effectiveMR)) * (1 - T.DRP)
    //console.log(`${this.NM} only magic resistence coefficient: ${(1 - effectiveMR / (100 + effectiveMR)).toFixed(3)}, coefficient: ${coefficient.toFixed(3)}`)
    const atd = coefficient * DMG * this.DIT(T)
    this.stealOnSpell(atd) // 计算法术吸血
    this.TD += atd
    this.TDM += atd
    return atd
  }
  /**
   * 计算和统计真实伤害
   * @param {Hero} T
   */
  realDamageOn(T, DMG) {
    const atd = DMG * this.DIT(T)
    this.TD += atd
    this.TDR += atd
    return atd
  }
  /**
   * 普通攻击函数
   * @param {Hero} T
   */
  attack(T) {
    this.LHT = Hero.ticks
    // console.log(this.NM + 'CAT: ' + this.CAT + '\n')
    if (!quietMode) console.log(`${this.NM} AP ${this.AP}, AH ${this.AH.toFixed(3)}, HP ${this.HP.toFixed(0)} (APMR ${this.APMR}, AHCR ${this.AHCR})`)
    this.CAT++
    const thisTurnIsCrit = Math.random() < (this.CR - T.CHCD)
    const actualDMG = this.armorDamageOn(T, this.AP, thisTurnIsCrit)
    T.HP -= actualDMG // make damage to target
    const stolenHP = this.stealOnHit(actualDMG)
    const rep = `伤害: ${actualDMG.toFixed(0)}, 吸血: ${stolenHP[1].toFixed(0)} / ${stolenHP[0].toFixed(0)}`
    if (!quietMode) console.log(thisTurnIsCrit ? chalk.red(rep) : chalk.gray(rep))
    this.OAH.forEach(fx => fx.call(this, T))
    T.OADH.forEach(fx => fx.call(T, this, actualDMG))
    if (thisTurnIsCrit) {
      this.OCHH.forEach(fx => fx.call(this, T, actualDMG))
      T.OCHDH.forEach(fx => fx.call(T, this, actualDMG))
    }
    // if (!quietMode) console.log(`${this.NM} target ${T.NM}.hp: ${T.HP.toFixed(0)}`)
    if (!quietMode) console.log(`${T.NM} AP ${T.AP}, AH ${T.AH.toFixed(3)}, HP ${T.HP.toFixed(0)} (APMR ${T.APMR}, AHCR ${T.AHCR})`)
  }
  print() {
    console.log(`
    ${this.NM}
    当前生命    ${this.HP.toFixed(0)} / ${this.MHP} ( ${(this.HP / this.MHP * 100).toFixed(1)} %)
    攻击力      ${this.AP}
    法术强度    ${this.SP}
    攻击速度    ${this.AH.toFixed(2)}
    暴击率      ${(this.CR * 100).toFixed(0)} %
    暴击伤害    ${(this.CDP * 100).toFixed(0)} %
    生命偷取    ${(this.HSOH * 100).toFixed(1)} %
    护甲穿透    ${(this.APP * 100).toFixed(0)} % | ${this.APV}
    法术穿透    ${(this.SPP * 100).toFixed(0)} % | ${this.SPV}
    ----------------------------
    每秒回复    ${(this.HRPT * Hero._tick).toFixed(2)}
    护甲        ${(this.AR).toFixed(0)}
    魔抗        ${(this.MR).toFixed(0)}
    百分比减伤  ${(this.DRP * 100).toFixed(2)} %
    暴击减伤    ${(this.CHDRP * 100).toFixed(2)} %
    暴击抵抗    ${(this.CHCD * 100).toFixed(2)} %
    ----------------------------
    攻击次数    ${this.CAT}
    总伤害      ${this.TD.toFixed(0)} ( ${(this.TD / (Hero.ticks / Hero._tick)).toFixed(2)} 每秒 )
      -物理伤害    ${this.TDP.toFixed(0)}
      -魔法伤害    ${this.TDM.toFixed(0)}
      -真实伤害    ${this.TDR.toFixed(0)}
    总生命偷取  ${this.TS.toFixed(0)}
    总回复      ${this.TR.toFixed(0)}
    `)
  }
}

Hero._tick = 1000000 // 每秒的tick数，越大计算越精确
Hero.ticks = 0 // 当前tick，表示时间的流逝
Hero.HeroOption = hero_option

module.exports = Hero
