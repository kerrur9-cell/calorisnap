-- ============================================================
-- 0001_foods.sql — стартовая база продуктов (~100 шт., verified).
-- Выполнить после 0001_init.sql.
-- ============================================================

INSERT INTO public.food_items
  (name, name_local, category, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, is_verified)
SELECT seed.* FROM (VALUES
  -- Крупы и злаки
  ('Buckwheat cooked', 'Гречка варёная', 'cereal', 110, 4.2, 0.9, 21.3, 'usda', TRUE),
  ('Oatmeal cooked', 'Овсянка варёная', 'cereal', 71, 2.5, 1.5, 12.0, 'usda', TRUE),
  ('Rice white cooked', 'Рис белый варёный', 'cereal', 130, 2.7, 0.3, 28.2, 'usda', TRUE),
  ('Rice brown cooked', 'Рис бурый варёный', 'cereal', 112, 2.3, 0.8, 23.5, 'usda', TRUE),
  ('Rice wild cooked', 'Рис дикий варёный', 'cereal', 101, 4.0, 0.3, 21.3, 'usda', TRUE),
  ('Couscous cooked', 'Кускус варёный', 'cereal', 112, 3.8, 0.2, 23.2, 'usda', TRUE),
  ('Pasta cooked', 'Макароны варёные', 'cereal', 158, 5.8, 0.9, 30.9, 'usda', TRUE),
  ('Millet cooked', 'Пшено варёное', 'cereal', 119, 3.5, 1.0, 23.7, 'usda', TRUE),
  ('Barley pearl cooked', 'Перловка варёная', 'cereal', 123, 2.3, 0.4, 28.2, 'usda', TRUE),
  ('Wheat bread', 'Хлеб пшеничный', 'bakery', 265, 9.4, 3.3, 48.9, 'usda', TRUE),
  ('Rye bread', 'Хлеб ржаной', 'bakery', 259, 8.5, 3.3, 48.3, 'usda', TRUE),
  ('Crispbread rye', 'Хлебцы ржаные', 'bakery', 320, 13.0, 3.0, 60.0, 'usda', TRUE),

  -- Мясо и птица
  ('Chicken breast raw', 'Куриная грудка сырая', 'meat', 120, 22.5, 2.6, 0.0, 'usda', TRUE),
  ('Chicken thigh', 'Бедро куриное', 'meat', 179, 18.4, 11.5, 0.0, 'usda', TRUE),
  ('Turkey breast', 'Индейка грудка', 'meat', 135, 29.3, 1.4, 0.0, 'usda', TRUE),
  ('Beef lean cooked', 'Говядина нежирная отварная', 'meat', 250, 26.0, 15.0, 0.0, 'usda', TRUE),
  ('Beef steak', 'Стейк из говядины', 'meat', 271, 25.0, 19.0, 0.0, 'usda', TRUE),
  ('Pork chop', 'Отбивная свиная', 'meat', 231, 25.7, 14.3, 0.0, 'usda', TRUE),
  ('Pork lean', 'Свинина нежирная', 'meat', 242, 27.0, 14.0, 0.0, 'usda', TRUE),
  ('Lamb', 'Баранина', 'meat', 282, 24.5, 20.3, 0.0, 'usda', TRUE),
  ('Mince beef', 'Фарш говяжий', 'meat', 259, 17.4, 20.0, 0.0, 'usda', TRUE),
  ('Ham', 'Ветчина', 'meat', 145, 20.9, 5.5, 1.5, 'usda', TRUE),

  -- Рыба и морепродукты
  ('Salmon', 'Сёмга/лосось', 'fish', 208, 20.4, 13.4, 0.0, 'usda', TRUE),
  ('Pink salmon', 'Горбуша', 'fish', 127, 20.5, 4.5, 0.0, 'usda', TRUE),
  ('Cod', 'Треска', 'fish', 82, 17.8, 0.7, 0.0, 'usda', TRUE),
  ('Pollock', 'Минтай', 'fish', 72, 15.9, 0.9, 0.0, 'usda', TRUE),
  ('Tuna canned in water', 'Тунец консервированный', 'fish', 103, 22.0, 1.0, 0.0, 'usda', TRUE),
  ('Shrimp', 'Креветки', 'fish', 99, 20.3, 1.7, 0.9, 'usda', TRUE),
  ('Squid', 'Кальмар', 'fish', 92, 15.6, 1.4, 3.1, 'usda', TRUE),
  ('Trout', 'Форель', 'fish', 141, 19.9, 6.6, 0.0, 'usda', TRUE),
  ('Herring', 'Сельдь', 'fish', 203, 18.0, 14.0, 0.0, 'usda', TRUE),
  ('Mackerel', 'Скумбрия', 'fish', 205, 18.6, 13.9, 0.0, 'usda', TRUE),

  -- Яйца, молочка
  ('Egg whole', 'Яйцо куриное', 'dairy', 143, 12.6, 9.5, 0.7, 'usda', TRUE),
  ('Egg white', 'Яичный белок', 'dairy', 52, 10.9, 0.2, 0.7, 'usda', TRUE),
  ('Milk 2.5%', 'Молоко 2,5%', 'dairy', 54, 3.0, 2.5, 4.7, 'usda', TRUE),
  ('Milk 3.2%', 'Молоко 3,2%', 'dairy', 60, 3.0, 3.2, 4.7, 'usda', TRUE),
  ('Kefir 2.5%', 'Кефир 2,5%', 'dairy', 51, 3.0, 2.5, 4.0, 'usda', TRUE),
  ('Yogurt plain 2.5%', 'Йогурт натуральный 2,5%', 'dairy', 60, 3.5, 2.5, 5.5, 'usda', TRUE),
  ('Cottage cheese 5%', 'Творог 5%', 'dairy', 121, 17.2, 5.0, 1.8, 'usda', TRUE),
  ('Cottage cheese 9%', 'Творог 9%', 'dairy', 159, 16.7, 9.0, 2.0, 'usda', TRUE),
  ('Cheese hard', 'Сыр твёрдый', 'dairy', 352, 24.9, 27.3, 1.1, 'usda', TRUE),
  ('Cheese mozzarella', 'Моцарелла', 'dairy', 280, 28.0, 17.0, 3.1, 'usda', TRUE),
  ('Cheese cottage light', 'Творог обезжиренный', 'dairy', 71, 12.0, 0.6, 3.4, 'usda', TRUE),
  ('Butter', 'Масло сливочное', 'dairy', 717, 0.9, 81.1, 0.1, 'usda', TRUE),
  ('Sour cream 15%', 'Сметана 15%', 'dairy', 162, 2.6, 15.0, 3.6, 'usda', TRUE),
  ('Ryazhenka 3.2%', 'Ряженка 3,2%', 'dairy', 66, 3.0, 3.2, 4.2, 'usda', TRUE),

  -- Овощи
  ('Potato boiled', 'Картофель отварной', 'vegetables', 87, 1.9, 0.1, 20.1, 'usda', TRUE),
  ('Tomato', 'Помидор', 'vegetables', 18, 0.9, 0.2, 3.9, 'usda', TRUE),
  ('Cucumber', 'Огурец', 'vegetables', 15, 0.7, 0.1, 3.6, 'usda', TRUE),
  ('Cabbage white', 'Капуста белокочанная', 'vegetables', 25, 1.3, 0.1, 5.8, 'usda', TRUE),
  ('Broccoli', 'Брокколи', 'vegetables', 34, 2.8, 0.4, 6.6, 'usda', TRUE),
  ('Carrot', 'Морковь', 'vegetables', 41, 0.9, 0.2, 9.6, 'usda', TRUE),
  ('Beetroot', 'Свёкла', 'vegetables', 43, 1.6, 0.2, 9.6, 'usda', TRUE),
  ('Onion', 'Лук репчатый', 'vegetables', 40, 1.1, 0.1, 9.3, 'usda', TRUE),
  ('Garlic', 'Чеснок', 'vegetables', 149, 6.4, 0.5, 33.1, 'usda', TRUE),
  ('Bell pepper', 'Перец болгарский', 'vegetables', 31, 1.0, 0.3, 6.0, 'usda', TRUE),
  ('Zucchini', 'Кабачок', 'vegetables', 17, 1.2, 0.3, 3.1, 'usda', TRUE),
  ('Eggplant', 'Баклажан', 'vegetables', 25, 1.0, 0.2, 5.9, 'usda', TRUE),
  ('Pumpkin', 'Тыква', 'vegetables', 26, 1.0, 0.1, 6.5, 'usda', TRUE),
  ('Mushrooms champignon', 'Шампиньоны', 'vegetables', 22, 3.1, 0.3, 3.3, 'usda', TRUE),
  ('Avocado', 'Авокадо', 'vegetables', 160, 2.0, 14.7, 8.5, 'usda', TRUE),
  ('Olive oil', 'Масло оливковое', 'vegetables', 884, 0.0, 100.0, 0.0, 'usda', TRUE),
  ('Sunflower oil', 'Масло подсолнечное', 'vegetables', 884, 0.0, 99.9, 0.0, 'usda', TRUE),

  -- Фрукты и ягоды
  ('Apple', 'Яблоко', 'fruit', 52, 0.3, 0.2, 13.8, 'usda', TRUE),
  ('Banana', 'Банан', 'fruit', 89, 1.1, 0.3, 22.8, 'usda', TRUE),
  ('Orange', 'Апельсин', 'fruit', 47, 0.9, 0.1, 11.8, 'usda', TRUE),
  ('Mandarin', 'Мандарин', 'fruit', 53, 0.8, 0.3, 13.3, 'usda', TRUE),
  ('Grapes', 'Виноград', 'fruit', 69, 0.7, 0.2, 18.1, 'usda', TRUE),
  ('Strawberry', 'Клубника', 'fruit', 32, 0.7, 0.3, 7.7, 'usda', TRUE),
  ('Blueberry', 'Черника', 'fruit', 57, 0.7, 0.3, 14.5, 'usda', TRUE),
  ('Raspberry', 'Малина', 'fruit', 52, 1.2, 0.7, 11.9, 'usda', TRUE),
  ('Pear', 'Груша', 'fruit', 57, 0.4, 0.1, 15.2, 'usda', TRUE),
  ('Kiwi', 'Киви', 'fruit', 61, 1.1, 0.5, 14.7, 'usda', TRUE),
  ('Peach', 'Персик', 'fruit', 39, 0.9, 0.3, 9.5, 'usda', TRUE),
  ('Watermelon', 'Арбуз', 'fruit', 30, 0.6, 0.2, 7.6, 'usda', TRUE),
  ('Lemon', 'Лимон', 'fruit', 29, 1.1, 0.3, 9.3, 'usda', TRUE),

  -- Орехи, семена, сухофрукты
  ('Walnuts', 'Грецкие орехи', 'nuts', 654, 15.2, 65.2, 13.7, 'usda', TRUE),
  ('Almonds', 'Миндаль', 'nuts', 579, 21.2, 49.9, 21.6, 'usda', TRUE),
  ('Hazelnuts', 'Фундук', 'nuts', 628, 15.0, 60.8, 16.7, 'usda', TRUE),
  ('Peanuts', 'Арахис', 'nuts', 567, 25.8, 49.2, 16.1, 'usda', TRUE),
  ('Cashews', 'Кешью', 'nuts', 553, 18.2, 43.8, 30.2, 'usda', TRUE),
  ('Pumpkin seeds', 'Семечки тыквенные', 'nuts', 559, 30.2, 49.1, 10.7, 'usda', TRUE),
  ('Sunflower seeds', 'Семечки подсолнечника', 'nuts', 584, 20.8, 51.5, 20.0, 'usda', TRUE),
  ('Raisins', 'Изюм', 'nuts', 299, 3.1, 0.5, 79.2, 'usda', TRUE),
  ('Prunes', 'Чернослив', 'nuts', 240, 2.2, 0.4, 63.9, 'usda', TRUE),

  -- Бобовые
  ('Chickpeas cooked', 'Нут варёный', 'legumes', 164, 8.9, 2.6, 27.4, 'usda', TRUE),
  ('Lentils cooked', 'Чечевица варёная', 'legumes', 116, 9.0, 0.4, 20.1, 'usda', TRUE),
  ('Beans red cooked', 'Фасоль красная варёная', 'legumes', 127, 8.7, 0.5, 22.8, 'usda', TRUE),
  ('Peas green', 'Горошек зелёный', 'legumes', 81, 5.4, 0.4, 14.5, 'usda', TRUE),

  -- Готовые блюда и прочее
  ('Borscht', 'Борщ', 'dish', 36, 1.9, 1.2, 5.2, 'usda', TRUE),
  ('Chicken soup', 'Суп куриный', 'dish', 38, 2.5, 1.0, 2.8, 'usda', TRUE),
  ('Pizza cheese', 'Пицца с сыром', 'dish', 266, 11.0, 10.0, 33.0, 'usda', TRUE),
  ('Dumplings pelmeni', 'Пельмени', 'dish', 226, 10.4, 8.6, 26.4, 'usda', TRUE),
  ('Buckwheat with chicken', 'Гречка с курицей', 'dish', 120, 9.0, 2.5, 14.0, 'usda', TRUE),
  ('Cottage cheese casserole', 'Запеканка творожная', 'dish', 168, 12.0, 5.0, 18.0, 'usda', TRUE),
  ('Scrambled eggs', 'Яичница', 'dish', 166, 11.0, 12.5, 1.0, 'usda', TRUE),
  ('Honey', 'Мёд', 'other', 304, 0.3, 0.0, 82.4, 'usda', TRUE),
  ('Chocolate dark 70%', 'Шоколад тёмный 70%', 'other', 598, 7.8, 42.6, 45.9, 'usda', TRUE),
  ('Chocolate milk', 'Шоколад молочный', 'other', 535, 7.7, 29.7, 59.4, 'usda', TRUE),
  ('Cookies oat', 'Овсяное печенье', 'bakery', 437, 6.5, 14.2, 71.2, 'usda', TRUE),
  ('Ice cream vanilla', 'Мороженое пломбир', 'other', 207, 3.5, 11.0, 23.6, 'usda', TRUE),
  ('Potato chips', 'Чипсы картофельные', 'other', 536, 6.8, 35.0, 52.0, 'usda', TRUE),
  ('Hummus', 'Хумус', 'legumes', 166, 7.9, 9.6, 14.3, 'usda', TRUE),
  ('Banana bread', 'Банановый хлеб', 'bakery', 326, 4.3, 10.5, 54.1, 'usda', TRUE)
) AS seed(name, name_local, category, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, is_verified)
WHERE NOT EXISTS (SELECT 1 FROM public.food_items f WHERE f.name = seed.name AND f.created_by IS NULL);
