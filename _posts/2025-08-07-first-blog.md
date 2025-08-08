---
layout:       post
title:        "I²Cw外设的总线位置"
author:       "Moni"
header-style: text
catalog:      true
tags:
    - Web
    - JavaScript
    - lain
---

> 在STM32F103微控制器中，关于I²C（Inter-Integrated Circuit）外设的总线位置，确实需要明确其硬件架构中的总线分布。以下是针对问题的详细分析：

---

### **1. STM32F103的I²C外设总线位置**
STM32F103系列微控制器的I²C外设**全部位于APB1（Advanced Peripheral Bus 1）总线**上。具体如下：
- **I²C1**：位于APB1总线，地址为`0x40005400`。
- **I²C2**（如果存在）：同样位于APB1总线，地址为`0x40005800`（STM32F103x8/xB/xE等型号支持I²C2）。

#### **关键点**：
- **APB1 vs APB2**：
  - APB1是低速外设总线（最高时钟频率36MHz），适用于低功耗或低速外设（如I²C、SPI2、USART2~3等）。
  - APB2是高速外设总线（最高时钟频率72MHz），适用于高速外设（如GPIO、USART1、ADC、TIM1等）。
- **I²C的时钟来源**：
  - I²C的时钟由APB1总线时钟分频得到，通常通过`RCC_CFGR`寄存器配置APB1的分频系数（如`PPRE1`位）。

---

### **2. 为什么I²C位于APB1？**
- **设计考量**：
  - I²C的通信速率通常较低（标准模式100kHz，快速模式400kHz），无需高速总线支持。
  - 将I²C分配到APB1可以降低功耗，并释放APB2的资源给更高性能的外设。
- **硬件资源优化**：
  - STM32F103的APB1总线已集成多个低速外设（如I²C、SPI2、USART2~3），便于总线复用和时钟管理。

---

### **3. 验证方法**
- **查阅参考手册**：
  - 在STM32F103的参考手册（如RM0008）中，可明确看到I²C1和I²C2的寄存器地址均位于APB1的地址空间。
- **时钟配置示例**：
  - 启用I²C时钟时，需操作APB1的时钟使能寄存器（`RCC_APB1ENR`）：
    ```c
    RCC->APB1ENR |= RCC_APB1ENR_I2C1EN; // 启用I²C1时钟
    ```

---

### **4. 对比其他外设**
- **APB1上的其他外设**：
  - SPI2、USART2~3、TIM2~7、IWDG、WWDG等。
- **APB2上的外设**：
  - GPIOA~G、USART1、ADC1~3、TIM1、TIM8、SPI1等。

---

### **5. 实际应用建议**
- **时钟配置**：
  - 确保APB1时钟已启用（通常通过`RCC_APB1ENR`寄存器）。
  - 根据I²C速率需求，配置APB1的分频系数（如`PPRE1=2`，即APB1时钟为系统时钟的1/2）。
- **外设初始化**：
  - 在初始化I²C时，需正确配置引脚（如PB6/PB7用于I²C1的SCL/SDA），并启用GPIO的复用功能（`AF_OD`模式）。

---

### **6. 总结**
- **结论**：STM32F103微控制器的所有I²C外设（I²C1和I²C2）均位于APB1总线。
- **原因**：I²C的低速特性与APB1的低功耗、低速设计相匹配，便于硬件资源优化和时钟管理。
- **建议**：在开发时，需注意APB1的时钟配置和I²C引脚的复用设置，确保外设正常工作。

通过以上分析，可以明确STM32F103的I²C外设总线位置及其设计考量，为实际应用提供指导。

![](https://Moni-heng.github.io/img/home-bg.jpg)
