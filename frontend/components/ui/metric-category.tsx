import { Feather } from "@expo/vector-icons";
import React, {useState} from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MetricCounter } from "./metric-counter"
import { MetricCategoryConfig } from "@/config/metricsConfig";

type Props = {
    category: MetricCategoryConfig;
    values: Record<string, number>;
    onChange: (fieldId: string, val: number) => void;
};

export function MetricCategory({ category, values, onChange }: Props) {
    const [expanded, setExpanded] = useState(false);
    const totalFilled = category.fields.reduce((sum, field) => sum + (values[field.id] ?? 0), 0);

    return (
        <View>
            <TouchableOpacity onPress={() => setExpanded((prev: boolean) => !prev)}>
            <View>
                {category.icon}
            </View>
            <Text> {category.label} </Text>
            {(totalFilled > 0) && (
                <Text>{totalFilled}</Text>
            )}
            <Feather 
                name={expanded ? "chevron-up" : "chevron-down"}
                size={20}
                color="#aaa"
            />
            </TouchableOpacity>
            {expanded && (
                <View>
                    {category.fields.map((field, index) => (
                        <MetricCounter
                        key={field.id}
                        label={field.label}
                        unit={field.unit}
                        value={values[field.id] ?? 0}
                        onChange={(val) => onChange(field.id, val)}
                        isLast={index === category.fields.length - 1}
                        />
                    ))}
                </View>
            )}
        </View>
    );
} 