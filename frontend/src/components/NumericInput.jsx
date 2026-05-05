import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

// Formata número para o padrão brasileiro (1.234,56)
const formatToBRL = (value) => {
    if (!value && value !== 0) return "";
    
    // Remove tudo que não é número ou vírgula
    let cleanValue = String(value).replace(/[^\d,]/g, "");
    
    // Se tiver múltiplas vírgulas, mantém apenas a primeira
    const parts = cleanValue.split(",");
    if (parts.length > 2) {
        cleanValue = parts[0] + "," + parts.slice(1).join("");
    }
    
    // Separa parte inteira da decimal
    let [intPart, decPart] = cleanValue.split(",");
    
    // Remove zeros à esquerda (exceto se for só "0" ou vazio)
    if (intPart && intPart.length > 1) {
        intPart = intPart.replace(/^0+(?=\d)/, "");
    }
    
    // Adiciona pontos como separador de milhar
    if (intPart) {
        intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    
    // Limita casas decimais a 2
    if (decPart !== undefined) {
        decPart = decPart.slice(0, 2);
        return `${intPart || "0"},${decPart}`;
    }
    
    return intPart || "";
};

// Converte do formato brasileiro para número (formato internacional)
const parseFromBRL = (value) => {
    if (!value) return "";
    
    // Remove pontos (separador de milhar) e troca vírgula por ponto
    const cleanValue = String(value)
        .replace(/\./g, "")
        .replace(",", ".");
    
    return cleanValue;
};

export const NumericInput = ({ 
    value, 
    onChange, 
    placeholder,
    className,
    id,
    readOnly = false,
    ...props 
}) => {
    const [displayValue, setDisplayValue] = useState("");
    const isInternalChange = useRef(false);

    // Atualiza o display quando o valor externo muda (não por digitação interna)
    useEffect(() => {
        if (isInternalChange.current) {
            isInternalChange.current = false;
            return;
        }
        
        if (value === "" || value === null || value === undefined) {
            setDisplayValue("");
        } else {
            // Converte o valor numérico para formato brasileiro
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                const formatted = numValue.toLocaleString("pt-BR", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                });
                setDisplayValue(formatted);
            } else {
                setDisplayValue("");
            }
        }
    }, [value]);

    const handleChange = (e) => {
        if (readOnly) return;
        
        let inputValue = e.target.value;
        
        // Permite apenas números, vírgula e ponto
        inputValue = inputValue.replace(/[^\d.,]/g, "");
        
        // Se digitou ponto, converte para vírgula (facilita digitação)
        inputValue = inputValue.replace(/\./g, ",");
        
        // Se tiver múltiplas vírgulas, mantém apenas a primeira
        const commaIndex = inputValue.indexOf(",");
        if (commaIndex !== -1) {
            const beforeComma = inputValue.substring(0, commaIndex);
            const afterComma = inputValue.substring(commaIndex + 1).replace(/,/g, "");
            inputValue = beforeComma + "," + afterComma;
        }
        
        // Formata para exibição (adiciona separador de milhar)
        const formatted = formatToBRL(inputValue);
        setDisplayValue(formatted);
        
        // Marca que é mudança interna para evitar loop
        isInternalChange.current = true;
        
        // Converte para o formato numérico e passa para o parent
        const numericValue = parseFromBRL(formatted);
        onChange(numericValue);
    };

    const handleBlur = () => {
        // Ao sair do campo, garante formatação correta
        if (displayValue) {
            const numericValue = parseFromBRL(displayValue);
            const numValue = parseFloat(numericValue);
            if (!isNaN(numValue)) {
                const formatted = numValue.toLocaleString("pt-BR", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                });
                setDisplayValue(formatted);
            }
        }
    };

    return (
        <Input
            id={id}
            type="text"
            inputMode="decimal"
            placeholder={placeholder || "0,00"}
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            readOnly={readOnly}
            className={`${className || ""} ${readOnly ? "bg-muted/50 cursor-default" : ""}`}
            {...props}
        />
    );
};
