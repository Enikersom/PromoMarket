import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, ChefHat, Clock, Users, DollarSign, Check, ShoppingBag } from 'lucide-react';
import { AIRecipe, PromotionItem } from '../types';

interface AIRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  promotions: PromotionItem[];
  onAddToCart: (item: PromotionItem) => void;
}

export const AIRecipeModal: React.FC<AIRecipeModalProps> = ({
  isOpen,
  onClose,
  promotions,
  onAddToCart
}) => {
  const [recipe, setRecipe] = useState<AIRecipe | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRecipe = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/suggest-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promotions })
      });
      if (res.ok) {
        const data = await res.json();
        setRecipe(data);
      }
    } catch (err) {
      console.error('Error fetching AI recipe:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !recipe) {
      fetchRecipe();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-purple-500/30 rounded-3xl max-w-2xl w-full p-6 text-white shadow-2xl relative space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl">
                <ChefHat className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white flex items-center">
                  Chef IA - Receitas Economizadoras
                  <Sparkles className="w-4 h-4 text-yellow-300 ml-1.5" />
                </h3>
                <p className="text-xs text-purple-200">
                  Receita gourmet criada aproveitando as melhores ofertas do encarte de hoje
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Loading or Content */}
          {loading ? (
            <div className="text-center py-12 space-y-3">
              <Sparkles className="w-10 h-10 text-purple-400 mx-auto animate-spin" />
              <p className="font-bold text-white text-base">Criando receita com as ofertas de hoje...</p>
              <p className="text-xs text-slate-400">
                Analisando preços promocionais de hortifruti, carnes e laticínios no PromoMarket
              </p>
            </div>
          ) : recipe ? (
            <div className="space-y-5">
              {/* Recipe Title & Meta */}
              <div className="bg-gradient-to-r from-purple-950/80 to-slate-950 p-5 rounded-2xl border border-purple-500/30">
                <h4 className="text-xl font-black text-white">{recipe.title}</h4>
                <p className="text-xs text-purple-200 mt-1">{recipe.description}</p>

                <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-purple-500/20 text-xs font-bold text-purple-200">
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1 text-purple-400" />
                    {recipe.prepTime}
                  </span>
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-1 text-purple-400" />
                    {recipe.servings}
                  </span>
                  <span className="flex items-center text-emerald-400">
                    <DollarSign className="w-4 h-4 mr-0.5" />
                    Custo Aprox: R$ {recipe.estimatedCost.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Ingredients Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Discounted Ingredients */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/30">
                  <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center">
                    <Check className="w-4 h-4 mr-1" />
                    Ingredientes do Encarte (Em Oferta):
                  </h5>
                  <ul className="text-xs text-slate-300 space-y-1">
                    {recipe.discountedIngredientsUsed.map((ing, i) => (
                      <li key={i} className="flex items-center">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-2" />
                        {ing}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Staples Needed */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Ingredientes Adicionais Básicos:
                  </h5>
                  <ul className="text-xs text-slate-300 space-y-1">
                    {recipe.additionalIngredientsNeeded.map((ing, i) => (
                      <li key={i} className="flex items-center">
                        <span className="w-1.5 h-1.5 bg-slate-600 rounded-full mr-2" />
                        {ing}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Preparation Steps */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Modo de Preparo Passo a Passo:
                </h5>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs text-slate-300">
                  {recipe.instructions.map((step, idx) => (
                    <div key={idx} className="flex items-start space-x-3">
                      <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0 text-[10px]">
                        {idx + 1}
                      </span>
                      <p className="pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={fetchRecipe}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
                >
                  🔄 Gerar Outra Receita
                </button>

                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg transition-all"
                >
                  Entendido & Ver Ofertas
                </button>
              </div>
            </div>
          ) : null}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
